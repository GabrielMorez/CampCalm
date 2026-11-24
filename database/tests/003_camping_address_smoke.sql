\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  test_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO campings (id, name, latitude, longitude, address_text)
  VALUES (test_id, 'Camping Teste Endereco', -26.9, -49.23, 'Rua das Flores, 123, Indaial - SC, Brasil');

  IF NOT EXISTS (
    SELECT 1 FROM campings
    WHERE id = test_id
      AND address_text = 'Rua das Flores, 123, Indaial - SC, Brasil'
      AND publication_status = 'PENDING_REVIEW'
  ) THEN
    RAISE EXCEPTION 'Endereco ou status de publicacao incorreto';
  END IF;

  RAISE NOTICE 'OK: endereco salvo e camping pendente de aprovacao';
END;
$$;
ROLLBACK;
