#!/usr/bin/env bash
# rollback-tcr.sh — Roll back the app to a specific image tag on the ECS server.
#
# Usage:
#   bash scripts/deploy/rollback-tcr.sh                # list available tags
#   bash scripts/deploy/rollback-tcr.sh a1b2c3d        # roll back to git sha tag
#   bash scripts/deploy/rollback-tcr.sh 20260610-1530   # roll back to timestamp tag
#   bash scripts/deploy/rollback-tcr.sh --yes 20260610-1530

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_SCRIPT="scripts/deploy/aliyun-backup-db.sh"

TCR_IMAGE="ccr.ccs.tencentyun.com/carrywu/shenlun"
DEPLOY_DIR="/opt/shenlun-material-hub"
YES=false

# ── Helpers ────────────────────────────────────────────────────────────────────

log() { printf '[rollback-tcr] %s\n' "$*"; }
die() { printf '[rollback-tcr] ERROR: %s\n' "$*" >&2; exit 1; }

# ── Parse arguments ────────────────────────────────────────────────────────────

TARGET_TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)
      YES=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--yes] <tag>"
      exit 0
      ;;
    *)
      if [ -n "$TARGET_TAG" ]; then
        die "Unexpected argument: $1"
      fi
      TARGET_TAG="$1"
      shift
      ;;
  esac
done

# ── Navigate to deploy dir ────────────────────────────────────────────────────

cd "$DEPLOY_DIR" || die "Deploy directory not found: $DEPLOY_DIR"

# ── No argument: show available tags ──────────────────────────────────────────

if [ -z "$TARGET_TAG" ]; then
  log "Available image tags for ${TCR_IMAGE}:"
  echo ""
  docker images --format 'table {{.Tag}}\t{{.ID}}\t{{.CreatedAt}}\t{{.Size}}' \
    "${TCR_IMAGE}" \
    2>/dev/null | head -20
  echo ""
  echo "Usage: $0 <tag>"
  echo "Example: $0 a1b2c3d"
  echo "Example: $0 20260610-1530"
  echo "Example: $0 --yes 20260610-1530"
  echo ""
  echo "Manual rollback:"
  echo "  cd ${DEPLOY_DIR}"
  echo "  IMAGE_TAG=<tag> docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} pull app"
  echo "  IMAGE_TAG=<tag> docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d --no-build app"
  exit 0
fi

# ── Verify target tag ─────────────────────────────────────────────────────────

log "Target tag: ${TARGET_TAG}"
FULL_IMAGE="${TCR_IMAGE}:${TARGET_TAG}"

# Check if image exists locally
if docker image inspect "$FULL_IMAGE" >/dev/null 2>&1; then
  log "Tag found locally"
else
  log "Tag not found locally, attempting to pull from TCR..."
  if docker pull "$FULL_IMAGE"; then
    log "Successfully pulled ${FULL_IMAGE}"
  else
    die "Failed to pull ${FULL_IMAGE}. Tag may not exist in TCR."
  fi
fi

# ── Show current version ──────────────────────────────────────────────────────

if [ -f REVISION ]; then
  log "Current version:"
  cat REVISION
  echo ""
fi

# ── Confirm rollback ──────────────────────────────────────────────────────────

if [ "$YES" = true ]; then
  log "Confirmation skipped by --yes"
else
  printf 'Roll back to tag "%s"? This will restart the app. [y/N] ' "$TARGET_TAG"
  read -r confirm
  case "$confirm" in
    [yY]|[yY][eE][sS]) ;;
    *) log "Aborted"; exit 0 ;;
  esac
fi

# ── Backup database ────────────────────────────────────────────────────────────

if [ -f "$BACKUP_SCRIPT" ]; then
  log "Backing up database before rollback"
  bash "$BACKUP_SCRIPT" || log "WARNING: Backup failed, continuing anyway"
else
  log "WARNING: Backup script not found, skipping backup"
fi

# ── Roll back ──────────────────────────────────────────────────────────────────

log "WARNING: This rollback only reverts the app image, NOT the database schema."
log "If the newer image had applied database migrations, the rolled-back app may fail due to schema mismatch."
log "Consider running: docker compose -f ${COMPOSE_FILE} run --rm --no-deps app npx prisma migrate status"

log "Stopping current app and starting with tag: ${TARGET_TAG}"
export IMAGE_TAG="$TARGET_TAG"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build app

# Ensure caddy follows
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-build caddy

# ── Health check ───────────────────────────────────────────────────────────────

HEALTH_URL="http://127.0.0.1/api/health"
log "Running health check..."

HEALTH_OK=false
for i in $(seq 1 6); do
  if curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q '"ok".*true'; then
    HEALTH_OK=true
    break
  fi
  log "  Attempt $i/6 failed, retrying in 10s..."
  sleep 10
done

if [ "$HEALTH_OK" = true ]; then
  log "Rollback SUCCESSFUL — running on tag: ${TARGET_TAG}"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

  # Write REVISION
  cat > REVISION <<EOF
IMAGE_TAG=${TARGET_TAG}
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DEPLOYED_BY=$(whoami)
ROLLED_BACK=true
EOF

  log "REVISION updated"
else
  log "Rollback FAILED — health check did not pass after 60s"
  log "Recent app logs:"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=50 app
  echo ""
  log "To manually roll back to the previous version:"
  log "  Check the REVISION file for the previous tag"
  log "  Or run: $0 <previous-tag>"
  exit 1
fi
