#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set a fresh, isolated PostgreSQL database URL}"
: "${BACKUP_PATH:?Set the backup file to restore}"
: "${RESTORE_CONFIRM:?Set RESTORE_CONFIRM=isolated-empty-database after verifying the destination}"
[[ "$RESTORE_CONFIRM" == "isolated-empty-database" ]] || exit 1
# No --clean or production database changes. Fail if the target already has data.
[[ "$(psql "$RESTORE_DATABASE_URL" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname='public'")" == '0' ]] || { printf 'Target is not empty.\n' >&2; exit 1; }
pg_restore --dbname="$RESTORE_DATABASE_URL" --exit-on-error --no-owner --no-privileges "$BACKUP_PATH"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS saved_personas FROM "Persona";' -c 'SELECT count(*) AS immutable_revisions FROM "PersonaRevision";' -c 'SELECT count(*) AS published_snapshots FROM "PublishedSnapshot";'
