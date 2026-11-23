-- CampCalm | 001 | PostgreSQL 17 + PostGIS 3.5
-- Entidades de domínio: Camper, Camping, Space e Reservation.
-- CHECK-IN incluso / CHECK-OUT exclusivo, correspondendo a Period.overlaps.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE campers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    email TEXT NOT NULL CHECK (length(btrim(email)) > 3),
    phone TEXT NOT NULL CHECK (length(btrim(phone)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive, sem introduzir citext na camada de domínio.
CREATE UNIQUE INDEX campers_email_lower_uniq ON campers (lower(email));

CREATE TABLE campings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    location geography(Point, 4326) GENERATED ALWAYS AS
      (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campings_active_location_gist ON campings USING gist (location)
  WHERE active = true;

CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camping_id UUID NOT NULL REFERENCES campings(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    dimensions TEXT,
    daily_rate_cents INTEGER NOT NULL CHECK (daily_rate_cents >= 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT spaces_id_camping_uniq UNIQUE (id, camping_id)
);

CREATE INDEX spaces_camping_active_idx ON spaces (camping_id, active);

-- Um espaço pode aceitar mais de um tipo de acomodação.
CREATE TABLE space_accommodation_types (
    space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    accommodation_type TEXT NOT NULL CHECK
      (accommodation_type IN ('TENT', 'MOTORHOME', 'TRAILER')),
    PRIMARY KEY (space_id, accommodation_type)
);

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camper_id UUID NOT NULL REFERENCES campers(id) ON DELETE RESTRICT,
    camping_id UUID NOT NULL REFERENCES campings(id) ON DELETE RESTRICT,
    space_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    daily_rate_cents INTEGER NOT NULL CHECK (daily_rate_cents >= 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK
      (status IN ('PENDING', 'CONFIRMED', 'REFUSED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reservations_positive_period CHECK (end_date > start_date),
    CONSTRAINT reservations_space_camping_fk FOREIGN KEY (space_id, camping_id)
      REFERENCES spaces (id, camping_id) ON DELETE RESTRICT,
    -- Protege contra concorrência mesmo sob múltiplas conexões/processos.
    -- Status REFUSED/CANCELLED não bloqueiam a vaga.
    CONSTRAINT reservations_no_active_overlap EXCLUDE USING gist (
      space_id WITH =,
      daterange(start_date, end_date, '[)') WITH &&
    ) WHERE (status IN ('PENDING', 'CONFIRMED'))
);

CREATE INDEX reservations_camper_created_idx ON reservations (camper_id, created_at DESC);
CREATE INDEX reservations_camping_status_date_idx
  ON reservations (camping_id, status, start_date, end_date);

-- Permite manter updated_at consistente em operações futuras.
CREATE OR REPLACE FUNCTION campcalm_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER campers_touch_updated_at BEFORE UPDATE ON campers
  FOR EACH ROW EXECUTE FUNCTION campcalm_set_updated_at();
CREATE TRIGGER campings_touch_updated_at BEFORE UPDATE ON campings
  FOR EACH ROW EXECUTE FUNCTION campcalm_set_updated_at();
CREATE TRIGGER spaces_touch_updated_at BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION campcalm_set_updated_at();
CREATE TRIGGER reservations_touch_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION campcalm_set_updated_at();
