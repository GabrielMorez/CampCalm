#!/bin/sh
# Executa migrations em ordem, numa transação única e com lock transacional.
# Reentrante: migrations registradas em schema_migrations não são reaplicadas.
set -eu

MIGRATIONS_DIR=${MIGRATIONS_DIR:-/migrations}
set -- "$MIGRATIONS_DIR"/*.sql
if [ ! -f "$1" ]; then
  echo "Nenhuma migration SQL encontrada em /migrations" >&2
  exit 1
fi

{
  printf '\\set ON_ERROR_STOP on\n'
  printf 'BEGIN;\n'
  printf 'SELECT pg_advisory_xact_lock(52002611);\n'
  printf 'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());\n'

  for file do
    version=${file##*/}
    version=${version%.sql}
    case "$version" in
      ''|*[!a-zA-Z0-9_-]*)
        echo "Versão de migration inválida: $version" >&2
        exit 1 ;;
    esac
    printf "SELECT NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version='%s') AS apply_migration \\gset\n" "$version"
    printf '\\if :apply_migration\n'
    printf '\\echo Applying %s\n' "$version"
    printf '\\i %s\n' "$file"
    printf "INSERT INTO schema_migrations(version) VALUES ('%s');\n" "$version"
    printf '\\else\n'
    printf '\\echo Skipping %s (already applied)\n' "$version"
    printf '\\endif\n'
  done

  printf 'COMMIT;\n'
} | psql -X -v ON_ERROR_STOP=1 -q
