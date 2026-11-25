-- 002_reservations.sql: rezerwacje, przypisanie stolików, blokada podwójnej rezerwacji, audyt

CREATE TYPE reservation_status AS ENUM
  ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
CREATE TYPE reservation_source AS ENUM
  ('client_app', 'staff_app', 'walk_in', 'phone');

CREATE TABLE reservations (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
  user_id       BIGINT REFERENCES users(id),          -- NULL dla walk-in / telefonu
  guest_name    TEXT NOT NULL,
  guest_phone   TEXT,
  party_size    SMALLINT NOT NULL CHECK (party_size > 0),
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  status        reservation_status NOT NULL DEFAULT 'confirmed',
  source        reservation_source NOT NULL,
  notes         TEXT,
  created_by    BIGINT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  seated_at     TIMESTAMPTZ,                          -- faktyczne wejście gości
  left_at       TIMESTAMPTZ,
  CHECK (ends_at > starts_at)
);
CREATE INDEX reservations_restaurant_starts_idx ON reservations (restaurant_id, starts_at);
CREATE INDEX reservations_user_idx ON reservations (user_id, starts_at DESC) WHERE user_id IS NOT NULL;

-- Jedna rezerwacja może zajmować kilka stolików.
-- during/active są kopią danych rezerwacji (utrzymywaną triggerami), żeby constraint
-- działał w samej bazie i gwarantował brak nakładających się rezerwacji tego samego stolika.
CREATE TABLE reservation_tables (
  reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  table_id       BIGINT NOT NULL REFERENCES dining_tables(id),
  during         TSTZRANGE NOT NULL,                  -- wypełniane triggerem
  active         BOOLEAN NOT NULL,                    -- false po cancel / no_show / completed
  PRIMARY KEY (reservation_id, table_id),
  EXCLUDE USING gist (table_id WITH =, during WITH &&) WHERE (active)
);

-- ---- Trigger: nowy wiersz reservation_tables dziedziczy czas i aktywność z rezerwacji ----
CREATE FUNCTION reservation_tables_fill() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  r      reservations%ROWTYPE;
  t_rest BIGINT;
BEGIN
  SELECT * INTO r FROM reservations WHERE id = NEW.reservation_id;
  SELECT restaurant_id INTO t_rest FROM dining_tables WHERE id = NEW.table_id;

  IF r.id IS NULL OR t_rest IS DISTINCT FROM r.restaurant_id THEN
    RAISE EXCEPTION 'Stolik % nie należy do restauracji rezerwacji %', NEW.table_id, NEW.reservation_id
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.during := tstzrange(r.starts_at, r.ends_at, '[)');
  NEW.active := r.status IN ('pending', 'confirmed', 'seated');
  RETURN NEW;
END $$;

CREATE TRIGGER reservation_tables_fill_trg
  BEFORE INSERT ON reservation_tables
  FOR EACH ROW EXECUTE FUNCTION reservation_tables_fill();

-- ---- Trigger: zmiana terminu / statusu rezerwacji przenosi się na stoliki ----
-- Jeśli nowy termin koliduje z inną rezerwacją, UPDATE kończy się błędem exclusion_violation.
CREATE FUNCTION reservations_sync_tables() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE reservation_tables
     SET during = tstzrange(NEW.starts_at, NEW.ends_at, '[)'),
         active = NEW.status IN ('pending', 'confirmed', 'seated')
   WHERE reservation_id = NEW.id;
  RETURN NULL;
END $$;

CREATE TRIGGER reservations_sync_tables_trg
  AFTER UPDATE OF starts_at, ends_at, status ON reservations
  FOR EACH ROW
  WHEN (OLD.starts_at IS DISTINCT FROM NEW.starts_at
     OR OLD.ends_at   IS DISTINCT FROM NEW.ends_at
     OR OLD.status    IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION reservations_sync_tables();

-- ---- Audyt ----
CREATE TABLE reservation_audit (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  actor_user_id  BIGINT REFERENCES users(id),
  action         TEXT NOT NULL,
  old_values     JSONB,
  new_values     JSONB,
  at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reservation_audit_reservation_idx ON reservation_audit (reservation_id, at);

-- Aplikacja może ustawić autora zmiany: SET LOCAL app.user_id = '42';
CREATE FUNCTION reservations_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_actor BIGINT := NULLIF(current_setting('app.user_id', true), '')::BIGINT;
  v_old   JSONB;
  v_new   JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO reservation_audit (reservation_id, actor_user_id, action, new_values)
    VALUES (NEW.id, COALESCE(v_actor, NEW.created_by), 'created', to_jsonb(NEW));
  ELSE
    SELECT jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, o.value)
      INTO v_new, v_old
      FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
     WHERE n.value IS DISTINCT FROM o.value;

    IF v_new IS NOT NULL THEN
      INSERT INTO reservation_audit (reservation_id, actor_user_id, action, old_values, new_values)
      VALUES (NEW.id, v_actor,
              CASE WHEN OLD.status <> NEW.status THEN 'status_' || NEW.status ELSE 'updated' END,
              v_old, v_new);
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER reservations_audit_trg
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION reservations_audit();

-- ---- Powiadomienie dla panelu pracownika: LISTEN reservation_changed ----
CREATE FUNCTION reservations_notify() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('reservation_changed', json_build_object(
    'id', NEW.id, 'restaurant_id', NEW.restaurant_id,
    'status', NEW.status, 'starts_at', NEW.starts_at)::text);
  RETURN NULL;
END $$;

CREATE TRIGGER reservations_notify_trg
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION reservations_notify();
