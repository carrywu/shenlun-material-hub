#!/usr/bin/env bash
# server-pull-and-restart.sh — Run on the ECS server to pull a new image and restart.
# Triggered remotely by deploy-tcr.sh via SSH, or manually on the server.
#
# Usage:
#   bash scripts/deploy/server-pull-and-restart.sh --tag 20260610-1530
#   bash scripts/deploy/server-pull-and-restart.sh               # defaults to latest

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
KEEP_TAGS="${KEEP_REMOTE_IMAGE_TAGS:-3}"
BACKUP_SCRIPT="scripts/deploy/aliyun-backup-db.sh"
ROLLBACK_SCRIPT="scripts/deploy/rollback-tcr.sh"

# ── Parse arguments ────────────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --compose-file)
      COMPOSE_FILE="$2"
      shift 2
      ;;
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────────────

log() { printf '[server-restart] %s\n' "$*"; }
die() { printf '[server-restart] ERROR: %s\n' "$*" >&2; exit 1; }

require_file() {
  if [ ! -f "$1" ]; then
    die "Missing required file: $1"
  fi
}

app_health_status() {
  local container_id
  container_id="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q app 2>/dev/null || true)"
  if [ -z "$container_id" ]; then
    printf 'missing'
    return 1
  fi

  docker inspect \
    --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "$container_id" 2>/dev/null || printf 'unknown'
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────

DEPLOY_DIR="/opt/shenlun-material-hub"
if [ ! -d "$DEPLOY_DIR" ]; then
  die "Deploy directory not found: $DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

command -v docker >/dev/null || die "docker is not installed"
docker compose version >/dev/null 2>&1 || die "docker compose is not available"

PREVIOUS_TAG=""
if [ -f REVISION ]; then
  PREVIOUS_TAG="$(awk -F= '$1 == "IMAGE_TAG" { print $2; exit }' REVISION)"
fi

# ── Pull new image ─────────────────────────────────────────────────────────────

TCR_IMAGE="ccr.ccs.tencentyun.com/carrywu/shenlun"

log "Pulling ${TCR_IMAGE}:${IMAGE_TAG}"
export IMAGE_TAG
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull app

# ── Backup database ────────────────────────────────────────────────────────────

if [ -f "$BACKUP_SCRIPT" ]; then
  log "Backing up database before restart"
  bash "$BACKUP_SCRIPT" || log "WARNING: Backup failed, continuing anyway"
else
  log "WARNING: Backup script not found at $BACKUP_SCRIPT, skipping backup"
fi

# ── Pre-migration schema check ────────────────────────────────────────────────

log "Checking current migration status before applying new migrations"
if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps app npx prisma migrate status; then
  warn "Migration status check reported issues — proceeding with migrate deploy"
  warn "If migrate deploy fails, check the migration status output above"
fi

# ── Run migrations with the new image before restarting app ───────────────────

log "Running database migrations with image tag: ${IMAGE_TAG}"
if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-deps app npx prisma migrate deploy; then
  die "Database migration failed; app was not restarted"
fi

# ── Restart app ────────────────────────────────────────────────────────────────

log "Restarting app with image tag: ${IMAGE_TAG}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build app

# Ensure wewe-rss sidecar is running (first deploy pulls the image automatically)
log "Ensuring wewe-rss sidecar is running"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build wewe-rss

# Ensure caddy is running (it depends on app healthy + wewe-rss, but force-check)
log "Ensuring caddy is running"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build caddy || \
  log "WARNING: caddy did not start before app health check"

# ── Wait and verify ────────────────────────────────────────────────────────────

log "Waiting 10s for containers to stabilize..."
sleep 10

log "Container status:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

# ── Health check ───────────────────────────────────────────────────────────────

log "Running app container health check"

HEALTH_OK=false
for i in $(seq 1 12); do
  APP_HEALTH="$(app_health_status)"
  log "  Attempt $i/12 app health: ${APP_HEALTH}"
  if [ "$APP_HEALTH" = "healthy" ]; then
    HEALTH_OK=true
    break
  fi
  sleep 10
done

if [ "$HEALTH_OK" = true ]; then
  log "Health check PASSED"
  PUBLIC_HEALTH_URL="http://127.0.0.1/api/health"
  PUBLIC_HEALTH_BODY="$(curl -fsS "$PUBLIC_HEALTH_URL" 2>/dev/null || true)"
  if printf '%s' "$PUBLIC_HEALTH_BODY" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true|"status"[[:space:]]*:[[:space:]]*"ok"'; then
    log "Local Caddy health check PASSED"
  else
    log "WARNING: Local Caddy health check did not pass immediately; deploy client will run external verification"
  fi
else
  log "Health check FAILED after 120s"
  log "Recent app logs:"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=50 app
  if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$IMAGE_TAG" ] && [ -f "$ROLLBACK_SCRIPT" ]; then
    log "Rolling back to previous image tag: ${PREVIOUS_TAG}"
    bash "$ROLLBACK_SCRIPT" --yes "$PREVIOUS_TAG"
  else
    log "No previous image tag available for automatic rollback"
  fi
  exit 1
fi

# ── Write REVISION ─────────────────────────────────────────────────────────────

cat > REVISION <<EOF
IMAGE_TAG=${IMAGE_TAG}
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOYED_BY=$(whoami)
EOF

log "REVISION written: ${IMAGE_TAG}"

# ── Cleanup old images ────────────────────────────────────────────────────────

log "Cleaning up old images (keeping ${KEEP_TAGS} versioned tags + latest)"
# List all tags except 'latest', sorted by creation date (newest first),
# skip the first KEEP_TAGS rows, delete the rest.
docker images --format '{{.Tag}}\t{{.ID}}' \
  "${TCR_IMAGE}" \
  | grep -v '^latest' \
  | sort -t $'\t' -k1 -r \
  | tail -n +"$((KEEP_TAGS + 1))" \
  | awk '{print $2}' \
  | xargs -r docker rmi 2>/dev/null || true

# Also remove dangling images (untagged) for this repo
docker image prune -f >/dev/null 2>&1 || true

log "Deploy complete: ${IMAGE_TAG}"
