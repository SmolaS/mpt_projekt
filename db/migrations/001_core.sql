-- 001_core.sql: restauracje, układ sali, użytkownicy, personel

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- potrzebne do EXCLUDE (bigint WITH =, tstzrange WITH &&)
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE restaurants (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                     TEXT NOT NULL,
  timezone                 TEXT NOT NULL DEFAULT 'Europe/Warsaw',
  slot_minutes             INT  NOT NULL DEFAULT 15 CHECK (slot_minutes > 0),
  default_duration_minutes INT  NOT NULL DEFAULT 90 CHECK (default_duration_minutes > 0),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- weekday: 0 = poniedziałek ... 6 = niedziela (czyli extract(isodow) - 1)
CREATE TABLE opening_hours (
  restaurant_id BIGINT   NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  weekday       SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at      TIME     NOT NULL,
  closes_at     TIME     NOT NULL,
  PRIMARY KEY (restaurant_id, weekday, opens_at),
  CHECK (closes_at > opens_at)   -- godziny po północy: osobny wpis na kolejny dzień
);

CREATE TABLE areas (             -- sala, taras, piętro
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  UNIQUE (restaurant_id, name)
);

CREATE TABLE dining_tables (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  area_id       BIGINT REFERENCES areas(id) ON DELETE SET NULL,
  label         TEXT NOT NULL,                       -- "12", "T-04"
  seats_min     SMALLINT NOT NULL DEFAULT 1 CHECK (seats_min > 0),
  seats_max     SMALLINT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  layout_x      REAL,                                -- pozycja na mapie sali
  layout_y      REAL,
  UNIQUE (restaurant_id, label),
  CHECK (seats_max >= seats_min)
);
CREATE INDEX dining_tables_restaurant_idx ON dining_tables (restaurant_id) WHERE is_active;

CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         CITEXT UNIQUE,
  phone         TEXT,
  full_name     TEXT NOT NULL,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TYPE staff_role AS ENUM ('host', 'waiter', 'manager', 'admin');

-- To samo konto może być klientem i pracownikiem. Brak wpisu = zwykły klient.
CREATE TABLE staff_memberships (
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role          staff_role NOT NULL,
  PRIMARY KEY (user_id, restaurant_id)
);
