-- CampCalm | Migration 002
-- Contas, autenticação, permissões e publicação de campings.
-- Dependência: 001_initial_schema.sql.
-- ============================================
-- 1. Usuários
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (length(btrim(email)) > 3),
  password_hash TEXT NOT NULL CHECK (length(password_hash) > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_uniq ON users (lower(email));

CREATE TRIGGER users_touch_updated_at BEFORE
UPDATE
  ON users FOR EACH ROW EXECUTE FUNCTION campcalm_set_updated_at();

-- ============================================
-- 2. Vínculo da conta com o perfil campista
-- ============================================
ALTER TABLE
  campers
ADD
  COLUMN user_id UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX campers_user_id_uniq ON campers (user_id)
WHERE
  user_id IS NOT NULL;

-- ============================================
-- 3. Vínculos administrativos dos campings
-- ============================================
CREATE TABLE camping_users (
  camping_id UUID NOT NULL REFERENCES campings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (camping_id, user_id)
);

CREATE INDEX camping_users_user_idx ON camping_users (user_id, camping_id);

-- ============================================
-- 4. Moderadores da plataforma
-- ============================================
CREATE TABLE platform_moderators (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Os moderadores serão concedidos por uma
-- operação administrativa controlada.
-- O cadastro público nunca poderá inserir
-- registros nesta tabela.
-- ============================================
-- 5. Controle de publicação dos campings
-- ============================================
ALTER TABLE
  campings
ADD
  COLUMN publication_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
ADD
  COLUMN submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD
  COLUMN reviewed_at TIMESTAMPTZ,
ADD
  COLUMN reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
ADD
  COLUMN review_note TEXT;

ALTER TABLE
  campings
ADD
  CONSTRAINT campings_publication_status_check CHECK (
    publication_status IN (
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED'
    )
  );

ALTER TABLE
  campings
ADD
  CONSTRAINT campings_publication_review_check CHECK (
    (
      publication_status = 'PENDING_REVIEW'
      AND reviewed_at IS NULL
      AND reviewed_by IS NULL
      AND review_note IS NULL
    )
    OR (
      publication_status = 'APPROVED'
      AND reviewed_at IS NOT NULL
      AND reviewed_by IS NOT NULL
      AND review_note IS NULL
    )
    OR (
      publication_status = 'REJECTED'
      AND reviewed_at IS NOT NULL
      AND reviewed_by IS NOT NULL
      AND review_note IS NOT NULL
      AND length(btrim(review_note)) > 0
    )
  );

-- Substitui o índice anterior por um índice
-- voltado especificamente aos campings públicos.
CREATE INDEX campings_published_location_gist ON campings USING gist (location)
WHERE
  active = TRUE
  AND publication_status = 'APPROVED';

DROP INDEX IF EXISTS campings_active_location_gist;

-- Facilita listar campings aguardando análise.
CREATE INDEX campings_pending_review_idx ON campings (submitted_at, id)
WHERE
  publication_status = 'PENDING_REVIEW';

-- ============================================
-- 6. Sessões de autenticação
-- ============================================
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE CHECK (
    refresh_token_hash ~ '^[0-9a-f]{64}$'
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT auth_sessions_valid_expiration CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id, expires_at)
WHERE
  revoked_at IS NULL;