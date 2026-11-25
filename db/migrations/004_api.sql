-- 004_api.sql: funkcje wywoływane przez aplikację (klient, pracownik, potok wizji) i widok mapy sali

-- ============================================================
-- Rezerwacje
-- ============================================================

-- Tworzy rezerwację i przypisuje stoliki w jednej transakcji.
-- Zwraca id rezerwacji. Błędy:
--   exclusion_violation (23P01) - stolik jest już zajęty w tym czasie (wyścig klient/pracownik)
--   check_violation     (23514) - zły stolik, za mała/za duża pojemność
CREATE FUNCTION create_reservation(
  p_restaurant_id    BIGINT,
  p_guest_name       TEXT,
  p_party_size       INT,
  p_starts_at        TIMESTAMPTZ,
  p_table_ids        BIGINT[],
  p_source           reservation_source,
  p_user_id          BIGINT DEFAULT NULL,
  p_guest_phone      TEXT   DEFAULT NULL,
  p_duration_minutes INT    DEFAULT NULL,
  p_notes            TEXT   DEFAULT NULL,
  p_created_by       BIGINT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
  v_dur      INT;
  v_id       BIGINT;
  v_wanted   INT;
  v_found    INT;
  v_seats    INT;
  v_min_seat INT;
BEGIN
  SELECT COALESCE(p_duration_minutes, default_duration_minutes) INTO v_dur
    FROM restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restauracja % nie istnieje', p_restaurant_id;
  END IF;

  v_wanted := (SELECT count(DISTINCT t) FROM unnest(p_table_ids) t);
  IF v_wanted IS NULL OR v_wanted = 0 THEN
    RAISE EXCEPTION 'Podaj co najmniej jeden stolik' USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*), COALESCE(sum(seats_max), 0), min(seats_min)
    INTO v_found, v_seats, v_min_seat
    FROM dining_tables
   WHERE id = ANY (p_table_ids) AND restaurant_id = p_restaurant_id AND is_active;

  IF v_found <> v_wanted THEN
    RAISE EXCEPTION 'Nieprawidłowy lub nieaktywny stolik w restauracji %', p_restaurant_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_seats < p_party_size THEN
    RAISE EXCEPTION 'Za mało miejsc: % przy stolikach na % osób', p_party_size, v_seats
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_found = 1 AND p_party_size < v_min_seat THEN
    RAISE EXCEPTION 'Stolik jest na minimum % osób', v_min_seat
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO reservations (restaurant_id, user_id, guest_name, guest_phone, party_size,
                            starts_at, ends_at, source, notes, created_by)
  VALUES (p_restaurant_id, p_user_id, p_guest_name, p_guest_phone, p_party_size,
          p_starts_at, p_starts_at + make_interval(mins => v_dur), p_source, p_notes, p_created_by)
  RETURNING id INTO v_id;

  INSERT INTO reservation_tables (reservation_id, table_id)
  SELECT DISTINCT v_id, t FROM unnest(p_table_ids) t;

  IF p_source = 'walk_in' THEN
    PERFORM set_reservation_status(v_id, 'seated', p_created_by);
  END IF;

  RETURN v_id;
END $$;

-- Zmiana statusu z efektem na stan stolików.
--   seated    -> stoliki 'occupied' (z nadpisaniem ręcznym do potwierdzenia przez wizję)
--   completed -> stoliki 'needs_cleaning'
--   cancelled / no_show -> stolik zwolniony z rezerwacji; stoliki przestają być zablokowane
CREATE FUNCTION set_reservation_status(
  p_reservation_id BIGINT,
  p_status         reservation_status,
  p_user_id        BIGINT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_old reservation_status;
BEGIN
  SELECT status INTO v_old FROM reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezerwacja % nie istnieje', p_reservation_id;
  END IF;
  IF v_old IN ('completed', 'cancelled') AND p_status <> v_old THEN
    RAISE EXCEPTION 'Rezerwacja % jest zakończona (%) i nie można zmienić jej statusu',
      p_reservation_id, v_old;
  END IF;

  PERFORM set_config('app.user_id', COALESCE(p_user_id::text, ''), true);

  UPDATE reservations
     SET status    = p_status,
         seated_at = CASE WHEN p_status = 'seated' AND seated_at IS NULL THEN now() ELSE seated_at END,
         left_at   = CASE WHEN p_status = 'completed' THEN now() ELSE left_at END
   WHERE id = p_reservation_id;

  IF p_status = 'seated' THEN
    UPDATE table_live_state
       SET state = 'occupied', reservation_id = p_reservation_id, since = now(),
           manual_override = true, pending_state = NULL, pending_count = 0, updated_at = now()
     WHERE table_id IN (SELECT table_id FROM reservation_tables WHERE reservation_id = p_reservation_id);
  ELSIF p_status = 'completed' THEN
    UPDATE table_live_state
       SET state = 'needs_cleaning', reservation_id = NULL, since = now(),
           manual_override = false, pending_state = NULL, pending_count = 0, updated_at = now()
     WHERE reservation_id = p_reservation_id;
  ELSIF p_status IN ('cancelled', 'no_show') THEN
    UPDATE table_live_state SET reservation_id = NULL, updated_at = now()
     WHERE reservation_id = p_reservation_id;
  END IF;
END $$;

-- ============================================================
-- Wizja: zapis detekcji z histerezą
-- ============================================================

-- Zapisuje zdarzenie i (po spełnieniu reguł) aktualizuje table_live_state. Zwraca aktualny stan.
-- Reguły:
--  * detekcja o niskiej pewności jest tylko logowana, nie zmienia stanu,
--  * zmiana stanu wymaga p_required_confirmations zgodnych detekcji z rzędu (histereza),
--  * occupied -> free daje 'needs_cleaning'; z 'needs_cleaning' wychodzi pracownik lub nowi goście,
--  * aktywne manual_override blokuje wizję; zdejmuje je detekcja zgodna z ręcznie ustawionym stanem.
CREATE FUNCTION record_occupancy_event(
  p_table_id               BIGINT,
  p_state                  occupancy_state,
  p_confidence             REAL        DEFAULT NULL,
  p_camera_id              BIGINT      DEFAULT NULL,
  p_people_count           INT         DEFAULT NULL,
  p_model_version          TEXT        DEFAULT NULL,
  p_raw                    JSONB       DEFAULT NULL,
  p_detected_at            TIMESTAMPTZ DEFAULT now(),
  p_required_confirmations INT         DEFAULT 3,
  p_min_confidence         REAL        DEFAULT 0.6
) RETURNS occupancy_state
LANGUAGE plpgsql AS $$
DECLARE
  ls      table_live_state%ROWTYPE;
  v_count INT;
  v_new   occupancy_state;
  v_res   BIGINT;
BEGIN
  IF to_regclass('occupancy_events_' || to_char(p_detected_at AT TIME ZONE 'UTC', 'YYYY_MM')) IS NULL THEN
    PERFORM ensure_occupancy_partition(p_detected_at);
  END IF;

  INSERT INTO occupancy_events (table_id, camera_id, state, confidence, people_count,
                                model_version, raw, detected_at)
  VALUES (p_table_id, p_camera_id, p_state, p_confidence, p_people_count,
          p_model_version, p_raw, p_detected_at);

  INSERT INTO table_live_state (table_id) VALUES (p_table_id) ON CONFLICT DO NOTHING;
  SELECT * INTO ls FROM table_live_state WHERE table_id = p_table_id FOR UPDATE;

  -- słaba detekcja: tylko log
  IF p_confidence IS NOT NULL AND p_confidence < p_min_confidence THEN
    RETURN ls.state;
  END IF;

  -- ręczne nadpisanie: wizja nie zmienia stanu, ale zgodna detekcja zdejmuje flagę
  IF ls.manual_override THEN
    IF p_state = ls.state THEN
      UPDATE table_live_state
         SET manual_override = false, confidence = p_confidence, updated_at = now()
       WHERE table_id = p_table_id;
    END IF;
    RETURN ls.state;
  END IF;

  -- po wyjściu gości stolik czeka na sprzątanie; "pusto" z kamery tego nie zmienia
  IF ls.state = 'needs_cleaning' AND p_state IN ('free', 'unknown') THEN
    RETURN ls.state;
  END IF;

  -- detekcja zgodna z obecnym stanem: kasuje kandydata
  IF p_state = ls.state THEN
    UPDATE table_live_state
       SET confidence = p_confidence, pending_state = NULL, pending_count = 0, updated_at = now()
     WHERE table_id = p_table_id;
    RETURN ls.state;
  END IF;

  -- kolejna detekcja tego samego kandydata?
  IF ls.pending_state IS NOT DISTINCT FROM p_state THEN
    v_count := ls.pending_count + 1;
  ELSE
    v_count := 1;
  END IF;

  IF v_count < p_required_confirmations THEN
    UPDATE table_live_state
       SET pending_state = p_state, pending_count = v_count, updated_at = now()
     WHERE table_id = p_table_id;
    RETURN ls.state;
  END IF;

  -- zatwierdzenie zmiany
  v_new := CASE WHEN ls.state = 'occupied' AND p_state = 'free' THEN 'needs_cleaning' ELSE p_state END;

  IF v_new = 'occupied' THEN
    SELECT r.id INTO v_res
      FROM reservation_tables rt
      JOIN reservations r ON r.id = rt.reservation_id
     WHERE rt.table_id = p_table_id AND rt.active
       AND r.status IN ('confirmed', 'seated')
       AND p_detected_at BETWEEN r.starts_at - interval '30 minutes' AND r.ends_at
     ORDER BY r.starts_at
     LIMIT 1;
  END IF;

  UPDATE table_live_state
     SET state          = v_new,
         confidence     = p_confidence,
         since          = p_detected_at,
         pending_state  = NULL,
         pending_count  = 0,
         reservation_id = CASE WHEN v_new = 'occupied' THEN COALESCE(reservation_id, v_res)
                               WHEN v_new IN ('free', 'needs_cleaning') THEN NULL
                               ELSE reservation_id END,
         updated_at     = now()
   WHERE table_id = p_table_id;

  RETURN v_new;
END $$;

-- Ręczna zmiana stanu przez pracownika (np. "posprzątane", "goście usiedli, kamera ich nie widzi").
CREATE FUNCTION set_table_state_manual(
  p_table_id BIGINT,
  p_state    occupancy_state,
  p_user_id  BIGINT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass('occupancy_events_' || to_char(now() AT TIME ZONE 'UTC', 'YYYY_MM')) IS NULL THEN
    PERFORM ensure_occupancy_partition(now());
  END IF;

  UPDATE table_live_state
     SET state = p_state, since = now(), manual_override = true,
         pending_state = NULL, pending_count = 0,
         reservation_id = CASE WHEN p_state = 'occupied' THEN reservation_id ELSE NULL END,
         updated_at = now()
   WHERE table_id = p_table_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stolik % nie istnieje', p_table_id;
  END IF;

  INSERT INTO occupancy_events (table_id, state, source, raw, detected_at)
  VALUES (p_table_id, p_state, 'manual', jsonb_build_object('user_id', p_user_id), now());
END $$;

-- ============================================================
-- Interfejs klienta: wolne terminy
-- ============================================================

-- Terminy (początki rezerwacji) danego dnia, w których jest wolny co najmniej jeden
-- pojedynczy stolik pasujący do liczby osób. Łączenie stolików nie jest tu uwzględniane.
CREATE FUNCTION available_slots(
  p_restaurant_id    BIGINT,
  p_party_size       INT,
  p_date             DATE,
  p_duration_minutes INT DEFAULT NULL
) RETURNS TABLE (slot_start TIMESTAMPTZ, tables_free INT)
LANGUAGE sql STABLE AS $$
  WITH r AS (
    SELECT id, timezone, slot_minutes,
           COALESCE(p_duration_minutes, default_duration_minutes) AS dur
      FROM restaurants WHERE id = p_restaurant_id
  ),
  slots AS (
    SELECT r.id AS restaurant_id, r.dur, gs AS slot_start
      FROM r
      JOIN opening_hours oh
        ON oh.restaurant_id = r.id
       AND oh.weekday = extract(isodow FROM p_date)::int - 1
      CROSS JOIN LATERAL generate_series(
             (p_date + oh.opens_at) AT TIME ZONE r.timezone,
             ((p_date + oh.closes_at) AT TIME ZONE r.timezone) - make_interval(mins => r.dur),
             make_interval(mins => r.slot_minutes)) gs
  )
  SELECT s.slot_start, count(t.id)::int
    FROM slots s
    JOIN dining_tables t
      ON t.restaurant_id = s.restaurant_id
     AND t.is_active
     AND p_party_size BETWEEN t.seats_min AND t.seats_max
   WHERE s.slot_start > now()
     AND NOT EXISTS (
           SELECT 1 FROM reservation_tables rt
            WHERE rt.table_id = t.id AND rt.active
              AND rt.during && tstzrange(s.slot_start, s.slot_start + make_interval(mins => s.dur), '[)'))
   GROUP BY s.slot_start
   ORDER BY s.slot_start;
$$;

-- Konkretne wolne stoliki dla wybranego terminu (po wyborze slotu przez klienta lub pracownika).
CREATE FUNCTION find_available_tables(
  p_restaurant_id BIGINT,
  p_party_size    INT,
  p_starts_at     TIMESTAMPTZ,
  p_ends_at       TIMESTAMPTZ
) RETURNS SETOF dining_tables
LANGUAGE sql STABLE AS $$
  SELECT t.*
    FROM dining_tables t
   WHERE t.restaurant_id = p_restaurant_id
     AND t.is_active
     AND p_party_size BETWEEN t.seats_min AND t.seats_max
     AND NOT EXISTS (
           SELECT 1 FROM reservation_tables rt
            WHERE rt.table_id = t.id AND rt.active
              AND rt.during && tstzrange(p_starts_at, p_ends_at, '[)'))
   ORDER BY t.seats_max, t.label;
$$;

-- ============================================================
-- Interfejs pracownika: mapa sali
-- ============================================================

CREATE VIEW v_floor_map AS
SELECT t.restaurant_id,
       t.id                          AS table_id,
       t.label,
       a.name                        AS area,
       t.seats_max,
       t.layout_x,
       t.layout_y,
       COALESCE(ls.state, 'unknown') AS state,
       ls.confidence,
       ls.since,
       COALESCE(ls.manual_override, false) AS manual_override,
       cur.id                        AS current_reservation_id,
       cur.guest_name                AS current_guest,
       nxt.id                        AS next_reservation_id,
       nxt.guest_name                AS next_guest,
       nxt.starts_at                 AS next_starts_at
  FROM dining_tables t
  LEFT JOIN areas a             ON a.id = t.area_id
  LEFT JOIN table_live_state ls ON ls.table_id = t.id
  LEFT JOIN reservations cur    ON cur.id = ls.reservation_id
  LEFT JOIN LATERAL (
        SELECT r.id, r.guest_name, r.starts_at
          FROM reservation_tables rt
          JOIN reservations r ON r.id = rt.reservation_id
         WHERE rt.table_id = t.id AND rt.active
           AND r.status IN ('pending', 'confirmed')
           AND r.ends_at > now()
         ORDER BY r.starts_at
         LIMIT 1) nxt ON true
 WHERE t.is_active;
