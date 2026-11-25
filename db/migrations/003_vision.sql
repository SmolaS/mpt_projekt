-- 003_vision.sql: kamery, powiązania stolik <-> obraz, log zdarzeń, stan na żywo

CREATE TABLE cameras (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  area_id       BIGINT REFERENCES areas(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  stream_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_seen_at  TIMESTAMPTZ
);

-- Metoda rozpoznawania stolika jest daną, nie schematem: zmiana metody to UPDATE/INSERT.
CREATE TYPE detection_method AS ENUM
  ('roi_zone', 'qr_marker', 'table_number_ocr', 'tag', 'manual');

CREATE TABLE table_detection_bindings (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_id     BIGINT NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  camera_id    BIGINT REFERENCES cameras(id) ON DELETE CASCADE,
  method       detection_method NOT NULL,
  marker_value TEXT,      -- treść QR / numer do OCR / id tagu
  roi          JSONB,     -- np. {"points": [[x,y], ...]} we współrzędnych 0..1
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (table_id, camera_id, method),
  CHECK (method <> 'roi_zone' OR roi IS NOT NULL),
  CHECK (method NOT IN ('qr_marker', 'table_number_ocr', 'tag') OR marker_value IS NOT NULL)
);
-- Ten sam marker nie może wskazywać dwóch stolików na jednej kamerze.
CREATE UNIQUE INDEX table_detection_bindings_marker_uq
  ON table_detection_bindings (camera_id, method, marker_value)
  WHERE marker_value IS NOT NULL AND is_active;

CREATE TYPE occupancy_state AS ENUM ('free', 'occupied', 'needs_cleaning', 'unknown');

-- Surowy log zdarzeń (append-only), partycjonowany miesięcznie.
-- Sekwencja jest jawna, bo kolumny IDENTITY w tabelach partycjonowanych bywają kłopotliwe.
CREATE SEQUENCE occupancy_events_id_seq AS BIGINT;

CREATE TABLE occupancy_events (
  id            BIGINT NOT NULL DEFAULT nextval('occupancy_events_id_seq'),
  table_id      BIGINT NOT NULL REFERENCES dining_tables(id),
  camera_id     BIGINT REFERENCES cameras(id) ON DELETE SET NULL,
  state         occupancy_state NOT NULL,
  confidence    REAL CHECK (confidence BETWEEN 0 AND 1),
  people_count  SMALLINT,
  source        TEXT NOT NULL DEFAULT 'vision',       -- vision | manual
  model_version TEXT,
  raw           JSONB,                                -- wyniki modelu, NIE klatki obrazu (RODO)
  detected_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, detected_at)
) PARTITION BY RANGE (detected_at);
ALTER SEQUENCE occupancy_events_id_seq OWNED BY occupancy_events.id;
CREATE INDEX occupancy_events_table_time_idx ON occupancy_events (table_id, detected_at DESC);

-- Partycja na miesiąc (granice w UTC), nazwa: occupancy_events_YYYY_MM
CREATE FUNCTION ensure_occupancy_partition(p_ts TIMESTAMPTZ) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_lo   TIMESTAMPTZ := date_trunc('month', p_ts AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_hi   TIMESTAMPTZ := (date_trunc('month', p_ts AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC';
  v_name TEXT := 'occupancy_events_' || to_char(p_ts AT TIME ZONE 'UTC', 'YYYY_MM');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('occupancy_events_partitions'));
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF occupancy_events FOR VALUES FROM (%L) TO (%L)',
                 v_name, v_lo, v_hi);
END $$;

-- Do wywoływania z crona (np. raz dziennie): tworzy partycje na bieżący i następne miesiące.
CREATE FUNCTION ensure_occupancy_partitions(p_months_ahead INT DEFAULT 2) RETURNS int
LANGUAGE plpgsql AS $$
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    PERFORM ensure_occupancy_partition(now() + make_interval(months => i));
  END LOOP;
  RETURN p_months_ahead + 1;
END $$;

SELECT ensure_occupancy_partitions(2);

-- Aktualny stan: jeden wiersz na stolik, czytany przez panel pracownika.
-- pending_* to licznik histerezy: stan zmienia się dopiero po N zgodnych detekcjach z rzędu.
CREATE TABLE table_live_state (
  table_id        BIGINT PRIMARY KEY REFERENCES dining_tables(id) ON DELETE CASCADE,
  state           occupancy_state NOT NULL DEFAULT 'unknown',
  confidence      REAL,
  since           TIMESTAMPTZ NOT NULL DEFAULT now(),
  reservation_id  BIGINT REFERENCES reservations(id) ON DELETE SET NULL,  -- kto aktualnie siedzi
  manual_override BOOLEAN NOT NULL DEFAULT false,      -- pracownik nadpisał wizję
  pending_state   occupancy_state,
  pending_count   INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Każdy nowy stolik od razu dostaje wiersz stanu 'unknown'.
CREATE FUNCTION dining_tables_init_live_state() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO table_live_state (table_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;

CREATE TRIGGER dining_tables_init_live_state_trg
  AFTER INSERT ON dining_tables
  FOR EACH ROW EXECUTE FUNCTION dining_tables_init_live_state();

INSERT INTO table_live_state (table_id) SELECT id FROM dining_tables ON CONFLICT DO NOTHING;

-- Push do panelu pracownika: LISTEN table_state
-- (tylko realne zmiany, nie każdy przyrost licznika histerezy)
CREATE FUNCTION table_live_state_notify() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_rest BIGINT;
BEGIN
  SELECT restaurant_id INTO v_rest FROM dining_tables WHERE id = NEW.table_id;
  PERFORM pg_notify('table_state', json_build_object(
    'restaurant_id', v_rest, 'table_id', NEW.table_id, 'state', NEW.state,
    'confidence', NEW.confidence, 'reservation_id', NEW.reservation_id,
    'manual_override', NEW.manual_override, 'since', NEW.since)::text);
  RETURN NULL;
END $$;

CREATE TRIGGER table_live_state_notify_trg
  AFTER UPDATE ON table_live_state
  FOR EACH ROW
  WHEN (OLD.state IS DISTINCT FROM NEW.state
     OR OLD.reservation_id IS DISTINCT FROM NEW.reservation_id
     OR OLD.manual_override IS DISTINCT FROM NEW.manual_override)
  EXECUTE FUNCTION table_live_state_notify();
