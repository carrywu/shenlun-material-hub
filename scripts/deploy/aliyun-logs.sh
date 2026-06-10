#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
SERVICE="${1:-app}"

case "$SERVICE" in
  app|postgres|caddy)
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=200 "$SERVICE"
    ;;
  all)
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f --tail=200
    ;;
  *)
    printf 'Usage: %s [app|postgres|caddy|all]\n' "$0" >&2
    exit 1
    ;;
esac
