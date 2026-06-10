#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

log() {
  printf '[aliyun-deploy] %s\n' "$*"
}

require_file() {
  if [ ! -f "$1" ]; then
    printf 'Missing required file: %s\n' "$1" >&2
    exit 1
  fi
}

validate_env() {
  require_file "$ENV_FILE"
  if grep -q 'CHANGE_ME' "$ENV_FILE"; then
    printf '%s still contains CHANGE_ME placeholders.\n' "$ENV_FILE" >&2
    exit 1
  fi
  if ! grep -Eq "^ADMIN_PASSWORD_HASH=['\"]?\\$2" "$ENV_FILE"; then
    printf 'ADMIN_PASSWORD_HASH must be set to a bcrypt hash in %s.\n' "$ENV_FILE" >&2
    exit 1
  fi
}

main() {
  require_file "$COMPOSE_FILE"
  validate_env

  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "Pulling latest code"
    git pull --ff-only
  fi

  mkdir -p backups data/uploads

  log "Building and starting containers"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

  log "Container status"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

  log "Health check"
  if curl -fsS http://127.0.0.1/api/health; then
    printf '\n'
  else
    log "Health check failed; recent app logs follow"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=120 app
    exit 1
  fi

  log "Deployment finished. Visit NEXT_PUBLIC_APP_URL or http://SERVER_IP/"
}

main "$@"
