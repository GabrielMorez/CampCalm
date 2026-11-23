\set ON_ERROR_STOP on

BEGIN;

INSERT INTO campings (
    id,
    name,
    latitude,
    longitude
)
VALUES (
    '00000000-0000-4000-8000-000000000201',
    'Camping Teste de Publicação',
    -26.897,
    -49.231
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM campings
        WHERE id =
          '00000000-0000-4000-8000-000000000201'
          AND active = TRUE
          AND publication_status = 'PENDING_REVIEW'
    ) THEN
        RAISE EXCEPTION
          'ERRO: camping nao iniciou pendente';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM campings
        WHERE id =
          '00000000-0000-4000-8000-000000000201'
          AND active = TRUE
          AND publication_status = 'APPROVED'
    ) THEN
        RAISE EXCEPTION
          'ERRO: camping nao aprovado esta publico';
    END IF;

    RAISE NOTICE
      'OK: camping criado aguardando aprovacao';
END;
$$;

ROLLBACK;
