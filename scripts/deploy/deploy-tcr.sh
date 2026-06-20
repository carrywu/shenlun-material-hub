#!/usr/bin/env bash
# deploy-tcr.sh — 构建镜像 → 推 TCR → 触发生产 ECS 拉镜像重启 → 健康检查。
#
# 构建 builder（默认 staging，Mac 本地作 fallback）：
#   --builder staging  在 staging(100.117.96.1, x86_64 原生) 上构建。推荐：
#                      Apple Silicon 本地跨架构构建会在 chown -R 步骤假性卡死。
#   --builder local    在本地 Mac 构建（staging 不可达时的 fallback）。
#
# Run from the project root on your local Mac:
#   bash scripts/deploy/deploy-tcr.sh                      # 默认 staging 构建
#   bash scripts/deploy/deploy-tcr.sh --builder local      # fallback 到 Mac
#   bash scripts/deploy/deploy-tcr.sh --dry-run
#   bash scripts/deploy/deploy-tcr.sh --skip-build         # 仅 local 生效
#   bash scripts/deploy/deploy-tcr.sh --tag custom-tag --no-confirm
#
# Requires: .env.deploy.local (TCR 凭证 + 生产 SSH)、staging SSH(carry@100.117.96.1 via Tailscale)

set -euo pipefail

# ── Resolve project directory ─────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.deploy.local}"

# ── Parse flags ────────────────────────────────────────────────────────────────

BUILDER="staging"
DRY_RUN=false
SKIP_BUILD=false
TAG_OVERRIDE=""
NO_CONFIRM=false

while [ $# -gt 0 ]; do
  case "$1" in
    --builder)     BUILDER="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=true; shift ;;
    --skip-build)  SKIP_BUILD=true; shift ;;
    --tag)         TAG_OVERRIDE="$2"; shift 2 ;;
    --no-confirm)  NO_CONFIRM=true; shift ;;
    --help|-h)
      cat <<EOF
Usage: $0 [--builder staging|local] [--dry-run] [--skip-build] [--tag <tag>] [--no-confirm]
  --builder staging  在 staging(x86 原生) 构建（默认，推荐）
  --builder local    在本地 Mac 构建（fallback；--skip-build 仅此模式生效）
EOF
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

case "$BUILDER" in
  staging|local) ;;
  *) printf 'Invalid --builder: %s (use staging|local)\n' "$BUILDER" >&2; exit 1 ;;
esac

# ── Helpers ────────────────────────────────────────────────────────────────────

log()    { printf '[deploy-tcr] %s\n' "$*"; }
warn()   { printf '[deploy-tcr] WARNING: %s\n' "$*" >&2; }
die()    { printf '[deploy-tcr] ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────

require_cmd git
require_cmd ssh
if [ "$BUILDER" = "local" ]; then
  require_cmd docker
  docker info >/dev/null 2>&1 || die "Docker daemon is not running. Start Docker Desktop first."
fi

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

# staging 构建机（builder=staging 时用）
STAGING_HOST="${STAGING_HOST:-100.117.96.1}"
STAGING_USER="${STAGING_USER:-carry}"
STAGING_DIR="${STAGING_DIR:-/home/carry/shenlun-material-hub-staging}"

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://${SERVER_HOST}/api/health}"

SERVER_SSH_TARGET="${SERVER_USER}@${SERVER_HOST}"
SERVER_SSH_OPTS="${SERVER_SSH_KEY_PATH:+-i $SERVER_SSH_KEY_PATH} -p $SERVER_PORT -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"
STAGING_SSH_TARGET="${STAGING_USER}@${STAGING_HOST}"
STAGING_SSH_OPTS="${SERVER_SSH_KEY_PATH:+-i $SERVER_SSH_KEY_PATH} -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"

# ── Compute tags ───────────────────────────────────────────────────────────────

cd "$PROJECT_DIR"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
TIMESTAMP="$(date +%Y%m%d-%H%M)"
DEPLOY_TAG="${TAG_OVERRIDE:-$TIMESTAMP}"

# ── Display deployment plan ───────────────────────────────────────────────────

BUILD_DESC="staging(${STAGING_SSH_TARGET}, x86_64 原生)"
[ "$BUILDER" = "local" ] && BUILD_DESC="local Mac(linux/amd64 模拟构建)"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TCR Deployment Plan                                        ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Builder: ${BUILD_DESC}"
echo "║  Image:   ${TCR_IMAGE}"
echo "║  Tags:    ${DEPLOY_TAG}, ${GIT_SHA}, latest"
echo "║  Server:  ${SERVER_SSH_TARGET}:${SERVER_DEPLOY_DIR}"
echo "║  Health:  ${HEALTHCHECK_URL}"
if [ "$SKIP_BUILD" = true ] && [ "$BUILDER" = "local" ]; then
echo "║  Mode:    SKIP BUILD (re-tag existing image)"
else
echo "║  Mode:    BUILD + PUSH"
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
  if [ "$BUILDER" = "staging" ]; then
    log "  [build] ssh ${STAGING_SSH_TARGET} 'cd ${STAGING_DIR} && git pull'"
    log "  [build] ssh staging 'docker login ${TCR_REGISTRY} && docker build -t ${TCR_IMAGE}:${DEPLOY_TAG} ... && docker push ...'"
  else
    log "  [build] docker login ${TCR_REGISTRY} -u ${TCR_USERNAME}"
    log "  [build] docker build -t ${TCR_IMAGE}:${DEPLOY_TAG} -t ${TCR_IMAGE}:${GIT_SHA} -t ${TCR_IMAGE}:latest ."
    log "  [build] docker push ${TCR_IMAGE}:{${DEPLOY_TAG},${GIT_SHA},latest}"
  fi
  log "  [gate]  check-schema-sync.sh --env production"
  log "  [gate]  ssh prod 'prisma migrate status'"
  log "  [deploy] ssh ${SERVER_SSH_TARGET} 'server-pull-and-restart.sh --tag ${DEPLOY_TAG}'"
  log "  [verify] curl ${HEALTHCHECK_URL}"
  exit 0
fi

[ -n "$TCR_PASSWORD" ] || die "TCR_PASSWORD 未设置（.env.deploy.local）"

# ── Build + Push (按 builder 分支) ─────────────────────────────────────────────

if [ "$BUILDER" = "staging" ]; then
  # ── staging 远程构建（x86 原生，不卡）──
  log "[staging] git pull 最新代码"
  ssh $STAGING_SSH_OPTS "$STAGING_SSH_TARGET" \
    "cd ${STAGING_DIR} && git fetch origin && git checkout main && git pull --ff-only origin main && git rev-parse --short HEAD" \
    || die "staging git pull 失败。staging 不可达？可用 --builder local 在 Mac 上重试。"

  log "[staging] 检查磁盘（构建需 ~3G）"
  FREE_GB="$(ssh $STAGING_SSH_OPTS "$STAGING_SSH_TARGET" 'df --output=avail -BG / | tail -1 | tr -dc "0-9"' 2>/dev/null || echo 0)"
  if [ "${FREE_GB:-0}" -lt 5 ]; then
    warn "staging 磁盘剩余 ${FREE_GB}G，偏低。建议先在 staging 跑 docker system prune -af"
    printf '继续构建? [y/N] '; read -r c; case "$c" in [yY]*) ;; *) exit 0 ;; esac
  fi

  log "[staging] docker login TCR + build + push (TCR 密码 stdin 传，不落盘)"
  # TCR 密码通过位置参数传给 staging 的 docker login（不出现在 staging 命令行历史/日志）。
  ssh $STAGING_SSH_OPTS "$STAGING_SSH_TARGET" bash -s \
    "$TCR_REGISTRY" "$TCR_USERNAME" "$TCR_PASSWORD" \
    "${TCR_IMAGE}" "$DEPLOY_TAG" "$GIT_SHA" "$STAGING_DIR" <<'REMOTE' \
    || die "staging 构建失败。可用 --builder local 在 Mac 上重试。"
set -euo pipefail
REG="$1"; USER="$2"; PASS="$3"; IMG="$4"; TAG="$5"; SHA="$6"; DIR="$7"
echo "$PASS" | docker login "$REG" -u "$USER" --password-stdin
cd "$DIR"
docker build --platform linux/amd64 -f Dockerfile \
  -t "$IMG:$TAG" -t "$IMG:$SHA" -t "$IMG:latest" .
echo "--- push ---"
docker push "$IMG:$TAG"
docker push "$IMG:$SHA"
docker push "$IMG:latest"
echo "--- 验证三 tag 同 digest ---"
docker inspect "$IMG:$TAG" --format '{{index .RepoDigests 0}}'
REMOTE
  log "staging 构建并推送完成"
else
  # ── 本地 Mac 构建（fallback）──
  log "[local] Logging in to TCR as ${TCR_USERNAME}"
  echo "$TCR_PASSWORD" | docker login "$TCR_REGISTRY" -u "$TCR_USERNAME" --password-stdin

  if [ "$SKIP_BUILD" = false ]; then
    log "[local] Building Docker image (linux/amd64)..."
    log "  ⚠️ Apple Silicon 上 chown -R 可能假性卡死；若久无输出，看 docker images 的 RepoDigest 确认是否已成。"
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
    docker tag "${TCR_IMAGE}:latest" "${TCR_IMAGE}:${DEPLOY_TAG}" 2>/dev/null || \
      die "No existing image ${TCR_IMAGE}:latest found. Run without --skip-build first."
    docker tag "${TCR_IMAGE}:latest" "${TCR_IMAGE}:${GIT_SHA}" 2>/dev/null || true
  fi

  log "[local] Pushing ${TCR_IMAGE}:{${DEPLOY_TAG},${GIT_SHA},latest}"
  docker push "${TCR_IMAGE}:${DEPLOY_TAG}"
  docker push "${TCR_IMAGE}:${GIT_SHA}"
  docker push "${TCR_IMAGE}:latest"
  log "All tags pushed to TCR"
fi

# ── Schema consistency check (blocking gate) ──────────────────────────────────

log "Checking schema consistency between code migrations and production database"
bash "$SCRIPT_DIR/check-schema-sync.sh" --env production \
  || die "Schema drift detected! Resolve differences before deploying. Run with --verbose for details."

# ── Pre-deploy migration status check ─────────────────────────────────────────

log "Checking production migration status before deploying"
ssh $SERVER_SSH_OPTS "$SERVER_SSH_TARGET" \
  "cd ${SERVER_DEPLOY_DIR} && set -a && source .env.production && set +a && \
   docker compose -f docker-compose.prod.yml run --rm --no-deps app npx prisma migrate status" \
  || warn "Production migration status check had warnings (proceeding with deploy)"

# ── Trigger remote deploy ─────────────────────────────────────────────────────

log "Triggering remote pull and restart on ${SERVER_SSH_TARGET}"
log "Uploading latest server restart script"
ssh $SERVER_SSH_OPTS "$SERVER_SSH_TARGET" \
  "mkdir -p ${SERVER_DEPLOY_DIR}/scripts/deploy"
if [ -n "${SERVER_SSH_KEY_PATH:-}" ]; then
  scp -P "$SERVER_PORT" -i "$SERVER_SSH_KEY_PATH" \
    "$SCRIPT_DIR/server-pull-and-restart.sh" \
    "${SERVER_SSH_TARGET}:${SERVER_DEPLOY_DIR}/scripts/deploy/server-pull-and-restart.sh"
else
  scp -P "$SERVER_PORT" \
    "$SCRIPT_DIR/server-pull-and-restart.sh" \
    "${SERVER_SSH_TARGET}:${SERVER_DEPLOY_DIR}/scripts/deploy/server-pull-and-restart.sh"
fi
ssh $SERVER_SSH_OPTS "$SERVER_SSH_TARGET" \
  "cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/server-pull-and-restart.sh --tag ${DEPLOY_TAG}" \
  || die "生产 restart 失败。小机器(2核1.6G)可能被压垮：分步做 —— 先 'docker compose run --rm app npx prisma migrate deploy'，再 'docker compose up -d app'。"

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
  echo "║  Builder: ${BUILDER}  Tag: ${DEPLOY_TAG} (${GIT_SHA})"
  echo "║  URL:  http://${SERVER_HOST}"
  echo "╚══════════════════════════════════════════════════════════════╝"
else
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ❌  DEPLOYMENT FAILED — health check timed out             ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  log "Check server logs:"
  log "  ssh ${SERVER_SSH_TARGET} 'cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/aliyun-logs.sh app'"
  log "Roll back with:"
  log "  ssh ${SERVER_SSH_TARGET} 'cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/rollback-tcr.sh <previous-tag>'"
  exit 1
fi
