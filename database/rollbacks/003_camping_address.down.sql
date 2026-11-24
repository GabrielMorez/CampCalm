-- ATENÇÃO: reversão destrói endereços armazenados na coluna address_text.
-- Execute somente após confirmar que a migration 003 é a mais recente.
BEGIN;
ALTER TABLE campings DROP CONSTRAINT IF EXISTS campings_address_text_nonempty;
ALTER TABLE campings DROP COLUMN IF EXISTS address_text;
DELETE FROM schema_migrations WHERE version = '003_camping_address';
COMMIT;
