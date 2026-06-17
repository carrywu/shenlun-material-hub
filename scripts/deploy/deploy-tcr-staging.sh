#!/usr/bin/env bash
# deploy-tcr-staging.sh — 在 staging 构建机(x86 原生)上构建镜像，推 TCR，
#                          再触发生产 ECS 拉镜像重启。
#
# 为什么不用 deploy-tcr.sh（本地 Mac 构建）：
#   Apple Silicon 跨架构模拟构建 amd64 时，Dockerfile 的 `chown -R` 步骤会假性卡死。
#   staging(100.117.96.1, carry 用户) 是 x86_64 原生 + 12 核，构建快且不卡。
#
# 流程：
#   本地 Mac → ssh staging → git pull → docker build(linux/amd64 原生) → docker push TCR
#          → ssh 生产 → server-pull-and-restart → 健康检查
#
# Run from local Mac:
#   bash scripts/deploy/deploy-tcr-staging.sh
#   bash scripts/deploy/deploy-tcr-staging.sh --dry-run
#   bash scripts/deploy/deploy-tcr-staging.sh --tag custom-tag --no-confirm
#
# Requires: .env.deploy.local (TCR 凭证 + 生产 SSH)、staging SSH(carry@100.117.96.1 via Tailscale)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.deploy.local}"

# ── Parse flags ────────────────────────────────────────────────────────────────
DRY_RUN=false; TAG_OVERRIDE=""; NO_CONFIRM=false
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)     DRY_RUN=true; shift ;;
    --tag)         TAG_OVERRIDE="$2"; shift 2 ;;
    --no-confirm)  NO_CONFIRM=true; shift ;;
    --help|-h)     echo "Usage: $0 [--dry-run] [--tag <tag>] [--no-confirm]"; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; exit 1 ;;
  esac
done

log()  { printf '[deploy-staging] %s\n' "$*"; }
warn() { printf '[deploy-staging] WARNING: %s\n' "$*" >&2; }
die()  { printf '[deploy-staging] ERROR: %s\n' "$*" >&2; exit 1; }

command -v ssh >/dev/null || die "ssh not found"
[ -f "$ENV_FILE" ] || die "Config not found: $ENV_FILE"

# ── Load config (TCR + 生产 SSH) ───────────────────────────────────────────────
set -a; source "$ENV_FILE"; set +a

TCR_REGISTRY="${TCR_REGISTRY:-ccr.ccs.tencentyun.com}"
TCR_NAMESPACE="${TCR_NAMESPACE:-carrywu}"
TCR_REPO="${TCR_REPO:-shenlun}"
TCR_USERNAME="${TCR_USERNAME:-100011725549}"
TCR_PASSWORD="${TCR_PASSWORD:-}"
TCR_IMAGE="${TCR_REGISTRY}/${TCR_NAMESPACE}/${TCR_REPO}"

# 生产 ECS
SERVER_HOST="${SERVER_HOST:-47.119.182.210}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
SERVER_DEPLOY_DIR="${SERVER_DEPLOY_DIR:-/opt/shenlun-material-hub}"
SSH_TARGET="${SERVER_USER}@${SERVER_HOST}"
SSH_OPTS="${SERVER_SSH_KEY_PATH:+-i $SERVER_SSH_KEY_PATH} -p $SERVER_PORT -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"

# staging 构建机
STAGING_HOST="${STAGING_HOST:-100.117.96.1}"
STAGING_USER="${STAGING_USER:-carry}"
STAGING_DIR="${STAGING_DIR:-/home/carry/shenlun-material-hub-staging}"
STAGING_SSH_OPTS="${STAGING_SSH_KEY_PATH:+-i $STAGING_SSH_KEY_PATH} -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://${SERVER_HOST}/api/health}"

# ── Tags ──────────────────────────────────────────────────────────────────────
GIT_SHA="$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
DEPLOY_TAG="${TAG_OVERRIDE:-$(date +%Y%m%d-%H%M)}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  TCR Deployment (staging build)                             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Build:  ${STAGING_USER}@${STAGING_HOST}:${STAGING_DIR} (x86_64)"
echo "║  Image:  ${TCR_IMAGE}"
echo "║  Tags:   ${DEPLOY_TAG}, ${GIT_SHA}, latest"
echo "║  Prod:   ${SSH_TARGET}:${SERVER_DEPLOY_DIR}"
if [ "$DRY_RUN" = true ]; then echo "║  *** DRY RUN ***"; fi
echo "╚══════════════════════════════════════════════════════════════╝"

if [ "$NO_CONFIRM" = false ] && [ "$DRY_RUN" = false ]; then
  printf 'Proceed? [y/N] '; read -r confirm
  case "$confirm" in [yY]|[yY][eE][sS]) ;; *) log "Aborted"; exit 0 ;; esac
fi

if [ "$DRY_RUN" = true ]; then
  log "DRY RUN — would:"
  log "  1. ssh ${STAGING_USER}@${STAGING_HOST} 'cd ${STAGING_DIR} && git pull'"
  log "  2. ssh staging 'docker login ${TCR_REGISTRY} && docker build -t ${TCR_IMAGE}:${DEPLOY_TAG} ... && docker push ...'"
  log "  3. ssh ${SSH_TARGET} 'server-pull-and-restart.sh --tag ${DEPLOY_TAG}'"
  log "  4. curl ${HEALTHCHECK_URL}"
  exit 0
fi

[ -n "$TCR_PASSWORD" ] || die "TCR_PASSWORD 未设置（.env.deploy.local）"

# ── 1. staging: git pull + 检查磁盘 ────────────────────────────────────────────
log "staging: git pull 最新代码"
ssh $STAGING_SSH_OPTS "${STAGING_USER}@${STAGING_HOST}" \
  "cd ${STAGING_DIR} && git fetch origin && git checkout main && git pull --ff-only origin main && git rev-parse --short HEAD" \
  || die "staging git pull 失败"

log "staging: 检查磁盘（构建需 ~3G）"
FREE_GB=$(ssh $STAGING_SSH_OPTS "${STAGING_USER}@${STAGING_HOST}" 'df --output=avail -BG / | tail -1 | tr -dc "0-9"')
if [ "${FREE_GB:-0}" -lt 5 ]; then
  warn "staging 磁盘剩余 ${FREE_GB}G，偏低。建议先清理：docker system prune -af"
  printf '继续构建? [y/N] '; read -r c; case "$c" in [yY]*) ;; *) exit 0 ;; esac
fi

# ── 2. staging: login + build + push ───────────────────────────────────────────
# TCR 密码通过 stdin 传给 staging 的 docker login，不落盘。
log "staging: docker login TCR + build + push (linux/amd64 原生)"
ssh $STAGING_SSH_OPTS "${STAGING_USER}@${STAGING_HOST}" bash -s "$TCR_REGISTRY" "$TCR_USERNAME" "$TCR_PASSWORD" \
  "${TCR_IMAGE}" "$DEPLOY_TAG" "$GIT_SHA" "$STAGING_DIR" <<'REMOTE'
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
log "镜像已推 TCR"

# ── 3. 生产: 拉镜像 + migrate + 重启 ───────────────────────────────────────────
log "生产: 拉镜像 + restart (tag ${DEPLOY_TAG})"
ssh $SSH_OPTS "$SSH_TARGET" \
  "cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/server-pull-and-restart.sh --tag ${DEPLOY_TAG}" \
  || die "生产 restart 失败（可能小机器被压垮，可分步：先 migrate 再 up -d app）"

# ── 4. 健康检查 ────────────────────────────────────────────────────────────────
log "健康检查 ${HEALTHCHECK_URL}"
for i in $(seq 1 12); do
  BODY="$(curl -fsS "$HEALTHCHECK_URL" 2>/dev/null || echo '')"
  if printf '%s' "$BODY" | grep -qEq '"ok"[[:space:]]*:[[:space:]]*true|"status"[[:space:]]*:[[:space:]]*"ok"'; then
    echo "╔════════════════════════════════════════╗"
    echo "║  ✅  DEPLOY SUCCESS  tag ${DEPLOY_TAG}   ║"
    echo "╚════════════════════════════════════════╝"
    exit 0
  fi
  log "  attempt $i/12, retry in 10s"; sleep 10
done

echo "╔════════════════════════════════════════╗"
echo "║  ❌  health check 超时                  ║"
echo "╚════════════════════════════════════════╝"
warn "查日志: ssh ${SSH_TARGET} 'cd ${SERVER_DEPLOY_DIR} && docker compose -f docker-compose.prod.yml logs app --tail 50'"
warn "回滚: ssh ${SSH_TARGET} 'cd ${SERVER_DEPLOY_DIR} && bash scripts/deploy/rollback-tcr.sh <旧tag>'"
exit 1
