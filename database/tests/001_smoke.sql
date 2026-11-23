-- Execute em uma base de desenvolvimento após docker compose run --rm migrate.
-- Todos os dados deste teste são artificiais e descartados com ROLLBACK.
\set ON_ERROR_STOP on
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS nao habilitado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION 'btree_gist nao habilitado';
  END IF;
END $$;

INSERT INTO campers (id, name, email, phone)
VALUES ('00000000-0000-4000-8000-000000000001', 'Campista Teste', 'teste@example.test', '47999999999');

INSERT INTO campings (id, name, latitude, longitude)
VALUES ('00000000-0000-4000-8000-000000000002', 'Camping Ficticio Teste', -26.897, -49.231);

INSERT INTO spaces (id, camping_id, name, daily_rate_cents)
VALUES ('00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000002', 'Lote 1', 5000);

INSERT INTO space_accommodation_types(space_id, accommodation_type)
VALUES ('00000000-0000-4000-8000-000000000003', 'TENT');

INSERT INTO reservations (id, camper_id, camping_id, space_id, start_date, end_date, daily_rate_cents)
VALUES ('00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003', '2027-01-10', '2027-01-12', 5000);

DO $$
BEGIN
  BEGIN
    INSERT INTO reservations (camper_id, camping_id, space_id, start_date, end_date, daily_rate_cents)
    VALUES ('00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000002',
            '00000000-0000-4000-8000-000000000003', '2027-01-11', '2027-01-13', 5000);
    RAISE EXCEPTION 'ERRO: sobreposicao foi aceita';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'OK: sobreposicao bloqueada por constraint';
  END;
END $$;

-- Check-out dia 12 + check-in dia 12 sao permitidos ([)).
INSERT INTO reservations (camper_id, camping_id, space_id, start_date, end_date, daily_rate_cents)
VALUES ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003', '2027-01-12', '2027-01-13', 5000);

-- Recusa nao bloqueia disponibilidade.
INSERT INTO reservations (camper_id, camping_id, space_id, start_date, end_date, daily_rate_cents, status)
VALUES ('00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003', '2027-01-10', '2027-01-11', 5000, 'REFUSED');

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM campings
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(-49.231, -26.897),4326)::geography,1000)) <> 1 THEN
    RAISE EXCEPTION 'ERRO: busca geografica inesperada';
  END IF;
  RAISE NOTICE 'OK: busca geografica e intervalos de check-in/check-out';
END $$;

ROLLBACK;
