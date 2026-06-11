#!/usr/bin/env bash
# deploy-tcr.sh — Build Docker image locally, push to Tencent Cloud TCR,
#                 then trigger the ECS server to pull and restart.
#
# Run from the project root on your local Mac:
#   bash scripts/deploy/deploy-tcr.sh
#   bash scripts/deploy/deploy-tcr.sh --dry-run
#   bash scripts/deploy/deploy-tcr.sh --skip-build
#   bash scripts/deploy/deploy-tcr.sh --tag custom-tag
#   bash scripts/deploy/deploy-tcr.sh --no-confirm
#
# Requires: Docker, Git, SSH access to ECS, .env.deploy.local config

set -euo pipefail

# ── Resolve project directory ─────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.deploy.local}"

# ── Parse flags ────────────────────────────────────────────────────────────────

DRY_RUN=false
SKIP_BUILD=false
TAG_OVERRIDE=""
NO_CONFIRM=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)     DRY_RUN=true; shift ;;
    --skip-build)  SKIP_BUILD=true; shift ;;
    --tag)         TAG_OVERRIDE="$2"; shift 2 ;;
    --no-confirm)  NO_CONFIRM=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--skip-build] [--tag <tag>] [--no-confirm]"
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────────────

log()    { printf '[deploy-tcr] %s\n' "$*"; }
warn()   { printf '[deploy-tcr] WARNING: %s\n' "$*" >&2; }
die()    { printf '[deploy-tcr] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────

require_cmd docker
require_cmd git
require_cmd ssh

# Verify Docker daemon is running
docker info >/dev/null 2>&1 || die "Docker daemon is not running. Start Docker Desktop first."

# ── Load configuration ────────────────────────────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
  die "Config file not found: $ENV_FILE\n  Copy from template: cp .env.deploy.example .env.deploy.local"
fi

# Source config (contains TCR_PASSWORD — never print it)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Apply defaults for values that may not be in .env.deploy.local
TCR_REGISTRY="${TCR_REGISTRY:-ccr.ccs.tencentyun.com}"
TCR_NAMESPACE="${TCR_NAMESPACE:-carrywu}"
TCR_REPO="${TCR_REPO:-shenlun}"
TCR_USERNAME="${TCR_USERNAME:-100011725549}"
TCR_PASSWORD="${TCR_PASSWORD:-}"
TCR_IMAGE="${TCR_REGISTRY}/${TCR_NAMESPACE}/${TCR_REPO}"

SERVER_HOST="${SERVER_HOST:-47.119.182.210}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
SERVER_DEPLOY_DIR="${SERVER_DEPLOY_DIR:-/opt/shenlun-material-hub}"

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://${SERVER_HOST}/api/health}"

SSH_TARGET="${SERVER_USER}@${SERVER_HOST}"
SSH_OPTS="${SERVER_SSH_KEY_PATH:+-i $SERVER_SSH_KEY_PATH} -p $SERVER_PORT -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

# ── Compute tags ───────────────────────────────────────────────────────────────

cd "$PROJECT_DIR"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
TIMESTAMP="$(date +%Y%m%d-%H%M)"
DEPLOY_TAG="${TAG_OVERRIDE:-$TIMESTAMP}"

# ── Display deployment plan ───────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TCR Deployment Plan                                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Image:  ${TCR_IMAGE}"
echo "║  Tags:   ${DEPLOY_TAG}, ${GIT_SHA}, latest"
echo "║  Server: ${SSH_TARGET}:${SERVER_DEPLOY_DIR}"
echo "║  Health: ${HEALTHCHECK_URL}"
if [ "$SKIP_BUILD" = true ]; then
echo "║  Mode:   SKIP BUILD (re-tag existing image)"
else
echo "║  Mode:   BUILD + PUSH"
fi
if [ "$DRY_RUN" = true ]; then
echo "║  *** DRY RUN — no changes will be made ***"
fi
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Confirm ────────────────────────────────────────────────────────────────────

if [ "$NO_CONFIRM" = false ] && [ "$DRY_RUN" = false ]; then
  printf 'Proceed with deployment? [y/N] '
  read -r confirm
  case "$confirm" in
    [yY]|[yY][eE][sS]) ;;
    *) log "Aborted"; exit 0 ;;
  esac
fi

# ── Dry run exit ───────────────────────────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
  log "DRY RUN — would execute:"
  log "  1. docker login ${TCR_REGISTRY} -u ${TCR_USERNAME}"
  log "  2. docker build -t ${TCR_IMAGE}:${DEPLOY_TAG} -t ${TCR_IMAGE}:${GIT_SHA} -t ${TCR_IMAGE}:latest ."
  log "  3. docker push ${TCR_IMAGE}:${DEPLOY_TAG}"
  log "  4. docker push ${TCR_IMAGE}:${GIT_SHA}"
  log "  5. docker push ${TCR_IMAGE}:latest"
  log "  6. ssh ${SSH_TARGET} 'cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/server-pull-and-restart.sh --tag ${DEPLOY_TAG}'"
  log "  7. Health check: curl ${HEALTHCHECK_URL}"
  exit 0
fi

# ── Docker login ──────────────────────────────────────────────────────────────

log "Logging in to TCR as ${TCR_USERNAME}"
if [ -n "$TCR_PASSWORD" ]; then
  # Non-interactive login
  echo "$TCR_PASSWORD" | docker login "$TCR_REGISTRY" -u "$TCR_USERNAME" --password-stdin
else
  # Interactive login — prompt user
  log "TCR_PASSWORD not set in ${ENV_FILE}"
  log "Falling back to interactive docker login"
  docker login "$TCR_REGISTRY" -u "$TCR_USERNAME"
fi

# ── Build ──────────────────────────────────────────────────────────────────────

if [ "$SKIP_BUILD" = false ]; then
  log "Building Docker image (linux/amd64)..."
  log "  Tag 1: ${TCR_IMAGE}:${DEPLOY_TAG}"
  log "  Tag 2: ${TCR_IMAGE}:${GIT_SHA}"
  log "  Tag 3: ${TCR_IMAGE}:latest"

  docker build \
    --platform linux/amd64 \
    -f "$PROJECT_DIR/Dockerfile" \
    -t "${TCR_IMAGE}:${DEPLOY_TAG}" \
    -t "${TCR_IMAGE}:${GIT_SHA}" \
    -t "${TCR_IMAGE}:latest" \
    "$PROJECT_DIR"

  log "Build complete"
else
  log "SKIP BUILD — re-tagging existing ${TCR_IMAGE}:latest"
  # Tag the existing latest image with the deploy tag and git sha
  docker tag "${TCR_IMAGE}:latest" "${TCR_IMAGE}:${DEPLOY_TAG}" 2>/dev/null || \
    die "No existing image ${TCR_IMAGE}:latest found. Run without --skip-build first."
  docker tag "${TCR_IMAGE}:latest" "${TCR_IMAGE}:${GIT_SHA}" 2>/dev/null || true
fi

# ── Push ───────────────────────────────────────────────────────────────────────

log "Pushing ${TCR_IMAGE}:${DEPLOY_TAG}"
docker push "${TCR_IMAGE}:${DEPLOY_TAG}"

log "Pushing ${TCR_IMAGE}:${GIT_SHA}"
docker push "${TCR_IMAGE}:${GIT_SHA}"

log "Pushing ${TCR_IMAGE}:latest"
docker push "${TCR_IMAGE}:latest"

log "All tags pushed to TCR"

# ── Trigger remote deploy ─────────────────────────────────────────────────────

log "Triggering remote pull and restart on ${SSH_TARGET}"
ssh $SSH_OPTS "$SSH_TARGET" \
  "cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/server-pull-and-restart.sh --tag ${DEPLOY_TAG}"

# ── Remote health check ───────────────────────────────────────────────────────

log "Verifying deployment via remote health check..."
HEALTH_OK=false
for i in $(seq 1 12); do
  HTTP_CODE="$(curl -fsS -o /dev/null -w '%{http_code}' "$HEALTHCHECK_URL" 2>/dev/null || echo '000')"
  BODY="$(curl -fsS "$HEALTHCHECK_URL" 2>/dev/null || echo '')"
  if printf '%s' "$BODY" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true|"status"[[:space:]]*:[[:space:]]*"ok"'; then
    HEALTH_OK=true
    break
  fi
  log "  Health check attempt $i/12 (HTTP $HTTP_CODE), retrying in 10s..."
  sleep 10
done

echo ""
if [ "$HEALTH_OK" = true ]; then
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ✅  DEPLOYMENT SUCCESSFUL                                  ║"
  echo "║  Tag: ${DEPLOY_TAG} (${GIT_SHA})"
  echo "║  URL:  http://${SERVER_HOST}"
  echo "╚══════════════════════════════════════════════════════════════╝"
else
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ❌  DEPLOYMENT FAILED — health check timed out             ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  log "Check server logs:"
  log "  ssh ${SSH_TARGET} 'cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/aliyun-logs.sh app'"
  log "Roll back with:"
  log "  ssh ${SSH_TARGET} 'cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/rollback-tcr.sh <previous-tag>'"
  exit 1
fi
