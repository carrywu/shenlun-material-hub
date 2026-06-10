#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_FILE="${1:-}"

log() {
  printf '[aliyun-restore-db] %s\n' "$*"
}

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  printf 'Usage: %s backups/file.dump\n' "$0" >&2
  exit 1
fi

printf 'This will replace the current PostgreSQL database from %s.\n' "$BACKUP_FILE"
printf 'Type RESTORE to continue: '
read -r confirmation
if [ "$confirmation" != "RESTORE" ]; then
  printf 'Restore cancelled.\n'
  exit 1
fi

log "Creating safety backup before restore"
bash scripts/deploy/aliyun-backup-db.sh

log "Stopping app during restore"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop app

log "Restoring database"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_restore -U shenlun -d shenlun_material_hub --clean --if-exists --no-owner <"$BACKUP_FILE"

log "Starting app"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app caddy
