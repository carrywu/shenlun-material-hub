#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-backups}"

log() {
  printf '[aliyun-backup-db] %s\n' "$*"
}

main() {
  mkdir -p "$BACKUP_DIR"
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  local file="$BACKUP_DIR/shenlun-material-hub-$stamp.dump"

  log "Creating PostgreSQL custom-format backup: $file"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    pg_dump -U shenlun -d shenlun_material_hub -Fc >"$file"
  chmod 600 "$file"
  log "Backup created: $file"
}

main "$@"
