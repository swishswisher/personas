#!/usr/bin/env bash
set -euo pipefail
: "${DIRECT_DATABASE_URL:?Set the direct PostgreSQL connection URL in the process environment}"
: "${BACKUP_PATH:?Set an encrypted-volume destination outside the repository}"
umask 077
pg_dump --dbname="$DIRECT_DATABASE_URL" --format=custom --no-owner --no-privileges --file="$BACKUP_PATH"
pg_restore --list "$BACKUP_PATH" > "$BACKUP_PATH.manifest"
printf 'Backup and restore manifest written.\n'
