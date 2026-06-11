#!/usr/bin/env bash
# ============================================================
# Staging 测试环境部署脚本
# ============================================================
#
# 两种运行模式：
#   1) 在 Linux 测试机上本机执行（推荐）：
#        bash scripts/deploy-staging.sh
#   2) 从 Mac 远程触发（需先配好 ssh 公钥免密）：
#        LINUX_HOST=100.117.96.1 bash scripts/deploy-staging.sh
#
# 流程：校验 .env.staging → git pull → docker build → up postgres
#       → prisma migrate deploy → 宿主机 pnpm seed:admin
#       → up app + wewe-rss → 健康检查
#
# 失败任意一步立即退出（set -euo pipefail）。
# ============================================================
set -euo pipefail

# ---------- 配置（可环境变量覆盖）----------
LINUX_HOST="${LINUX_HOST:-}"                          # 空=本机模式；填了=远程模式
LINUX_USER="${LINUX_USER:-carry}"
REMOTE_DIR="${REMOTE_DIR:-/home/carry/shenlun-material-hub-staging}"
REMOTE_GIT_URL="${REMOTE_GIT_URL:-https://github.com/carrywu/shenlun-material-hub}"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE=".env.staging"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5433}"
POSTGRES_DB_DEFAULT="shenlun_material_hub"

# 颜色
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}❌${NC} $*" >&2; exit 1; }

# 远程 or 本机执行
is_remote=0
if [[ -n "${LINUX_HOST}" ]]; then is_remote=1; fi

# 远程命令的环境前置（PATH 含 pnpm + 代理；ssh 非交互 shell 不加载 .bashrc，需显式注入）
REMOTE_ENV_PRELUDE='export PATH="$HOME/.local/bin:$PATH"
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897
cd_project() { cd "$1" 2>/dev/null || { echo "目录不存在"; return 1; }; }'

run() {
  if [[ "$is_remote" == "1" ]]; then
    ssh -o BatchMode=yes "${LINUX_USER}@${LINUX_HOST}" "bash -s" <<EOF
${REMOTE_ENV_PRELUDE}
$1
EOF
  else
    bash -c "$1"
  fi
}

# ---------- 0. 前置检查 ----------
log "目标：${LINUX_USER}@${LINUX_HOST:-<本机>}:${REMOTE_DIR}"
[[ "$is_remote" == "1" ]] && log "(远程模式)" || log "(本机模式)"

# ---------- 1. 校验 .env.staging 存在 + 关键字段已填 ----------
log "校验 ${ENV_FILE}"
run "
  cd ${REMOTE_DIR} 2>/dev/null || { echo '❌ 目录 ${REMOTE_DIR} 不存在，请先 git clone'; exit 1; }
  test -f ${ENV_FILE} || { echo '❌ ${ENV_FILE} 不存在。请执行: cp .env.staging.example .env.staging 并填写'; exit 1; }
  grep -q '^POSTGRES_PASSWORD=__手动填写__' ${ENV_FILE} && { echo '❌ POSTGRES_PASSWORD 仍是占位符'; exit 1; } || true
  grep -q '^ADMIN_PASSWORD=__手动填写__' ${ENV_FILE} && { echo '❌ ADMIN_PASSWORD 仍是占位符'; exit 1; } || true
  grep -q '^AI_CONFIG_ENCRYPTION_KEY=__手动填写__' ${ENV_FILE} && { echo '❌ AI_CONFIG_ENCRYPTION_KEY 仍是占位符'; exit 1; } || true
  grep -q '^JWT_SECRET=__手动填写__' ${ENV_FILE} && { echo '❌ JWT_SECRET 仍是占位符'; exit 1; } || true
  echo '✓ env 校验通过'
" || die "env 校验失败"

# ---------- 2. git pull ----------
log "git pull"
run "
  cd ${REMOTE_DIR}
  if [[ ! -d .git ]]; then
    echo '首次部署：clone 仓库'
    git clone ${REMOTE_GIT_URL} .
  fi
  git pull --ff-only
" || die "git pull 失败"

# ---------- 3. docker build + up postgres ----------
log "docker compose build"
run "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} build" || die "build 失败"

log "启动 postgres"
run "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d --wait postgres" || die "postgres 启动失败"

# ---------- 4. prisma migrate deploy（容器内跑，不需要 devDeps）----------
log "prisma migrate deploy"
run "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} exec -T app npx prisma migrate deploy" || die "迁移失败"
ok "迁移完成"

# ---------- 5. seed-admin（宿主机 pnpm 跑，连 staging postgres 5433 端口）----------
log "seed-admin（幂等）"
run "
  cd ${REMOTE_DIR}
  # 读 .env.staging 的字段
  PG_PWD=\$(grep '^POSTGRES_PASSWORD=' ${ENV_FILE} | cut -d= -f2-)
  ADMIN_USER=\$(grep '^ADMIN_USERNAME=' ${ENV_FILE} | cut -d= -f2-)
  ADMIN_PWD=\$(grep '^ADMIN_PASSWORD=' ${ENV_FILE} | cut -d= -f2-)
  PG_DB=\$(grep '^POSTGRES_DB=' ${ENV_FILE} | cut -d= -f2-)
  PG_DB=\${PG_DB:-${POSTGRES_DB_DEFAULT}}

  export DATABASE_URL=\"postgresql://shenlun:\${PG_PWD}@127.0.0.1:${POSTGRES_HOST_PORT}/\${PG_DB}?schema=public\"
  export ADMIN_USERNAME=\${ADMIN_USER}
  export ADMIN_PASSWORD=\${ADMIN_PWD}
  export NODE_ENV=production

  # 确保 node_modules 存在
  [[ -d node_modules ]] || pnpm install --frozen-lockfile

  pnpm seed:admin && echo '✓ seed-admin 成功' || echo '⚠ seed-admin 跳过（可能已存在管理员或失败，看上面日志）'
" || warn "seed-admin 环节有警告（非致命，继续）"

# ---------- 6. up app + wewe-rss ----------
log "启动 app + wewe-rss"
run "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d" || die "app/wewe-rss 启动失败"

# ---------- 7. 健康检查 ----------
log "等待 app 健康..."
sleep 6
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "${SCRIPT_DIR}/check-staging.sh" ]]; then
  if [[ "$is_remote" == "1" ]]; then
    LINUX_HOST=${LINUX_HOST} bash "${SCRIPT_DIR}/check-staging.sh" || warn "健康检查未通过，请看 check-staging.sh 输出"
  else
    bash "${SCRIPT_DIR}/check-staging.sh" || warn "健康检查未通过，请看 check-staging.sh 输出"
  fi
fi

echo ""
ok "Staging 部署完成"
echo "   Linux 本机访问:  http://127.0.0.1:3001"
echo "   Mac Tailscale:   http://${LINUX_HOST:-100.117.96.1}:3001"
echo "   wewe-rss 配置:   http://${LINUX_HOST:-100.117.96.1}:4000"
echo "   健康检查:        curl http://${LINUX_HOST:-100.117.96.1}:3001/api/health"
