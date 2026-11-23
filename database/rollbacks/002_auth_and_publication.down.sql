
BEGIN;

-- Remove as tabelas de autenticação e autorização.
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS platform_moderators;
DROP TABLE IF EXISTS camping_users;

-- Remove os índices de publicação.
DROP INDEX IF EXISTS campings_pending_review_idx;
DROP INDEX IF EXISTS campings_published_location_gist;

-- Remove o controle de publicação.
ALTER TABLE campings
    DROP CONSTRAINT IF EXISTS campings_publication_review_check;

ALTER TABLE campings
    DROP CONSTRAINT IF EXISTS campings_publication_status_check;

ALTER TABLE campings
    DROP COLUMN IF EXISTS review_note,
    DROP COLUMN IF EXISTS reviewed_by,
    DROP COLUMN IF EXISTS reviewed_at,
    DROP COLUMN IF EXISTS submitted_at,
    DROP COLUMN IF EXISTS publication_status;

-- Restaura o índice geográfico da 001.
CREATE INDEX IF NOT EXISTS campings_active_location_gist
    ON campings USING gist (location)
    WHERE active = TRUE;

-- Remove o vínculo entre campista e usuário.
ALTER TABLE campers
    DROP COLUMN IF EXISTS user_id;

-- Remove os usuários e seu trigger.
DROP TRIGGER IF EXISTS users_touch_updated_at ON users;

DROP TABLE IF EXISTS users;

-- Remove a migration do histórico.
DELETE FROM schema_migrations
WHERE version = '002_auth_and_publication';

COMMIT;
