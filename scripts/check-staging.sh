#!/usr/bin/env bash
# ============================================================
# Staging 健康检查脚本
# ============================================================
#
# 检查项：
#   1. docker compose 服务状态
#   2. 3001 / 4000 端口监听
#   3. /api/health 公开端点
#   4. 首页 HTTP 状态
#   5. 数据库迁移状态（_prisma_migrations）
#
# 运行：
#   本机模式：  bash scripts/check-staging.sh
#   远程模式：  LINUX_HOST=100.117.96.1 bash scripts/check-staging.sh
# ============================================================
set -uo pipefail

LINUX_HOST="${LINUX_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-/home/carry/shenlun-material-hub-staging}"
COMPOSE_FILE="docker-compose.staging.yml"
POSTGRES_DB="${POSTGRES_DB:-shenlun_material_hub}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
section() { echo -e "\n${CYAN}=== $* ===${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; }

is_remote=0
[[ -n "${LINUX_HOST}" ]] && is_remote=1

run() {
  if [[ "$is_remote" == "1" ]]; then
    ssh -o BatchMode=yes "root@${LINUX_HOST}" "bash -s" <<EOF
$1
EOF
  else
    bash -c "$1"
  fi
}

# host:port 拼接（curl 用）
url() {
  if [[ "$is_remote" == "1" ]]; then echo "${LINUX_HOST}:$1";
  else echo "127.0.0.1:$1"; fi
}

section "1. docker compose ps"
run "cd ${REMOTE_DIR} 2>/dev/null && docker compose -f ${COMPOSE_FILE} ps" || warn "compose ps 失败"

section "2. 端口监听 (3001 / 4000 / 5433)"
run "ss -lntp 2>/dev/null | grep -E ':3001|:4000|:5433' || echo '⚠ 没有发现 3001/4000/5433 监听'"

section "3. /api/health (公开端点)"
if curl -fsS --max-time 8 "http://$(url 3001)/api/health"; then
  echo; ok "health 正常"
else
  fail "health 失败（http://$(url 3001)/api/health）"
fi

section "4. 首页 HTTP 状态"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://$(url 3001)/" || echo "000")
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "307" || "$HTTP_CODE" == "302" ]]; then
  ok "首页返回 ${HTTP_CODE}"
else
  fail "首页异常：HTTP ${HTTP_CODE}"
fi

section "5. 数据库迁移状态"
run "
  cd ${REMOTE_DIR} 2>/dev/null && \
  docker compose -f ${COMPOSE_FILE} exec -T postgres \
    psql -U shenlun -d ${POSTGRES_DB} -c \
    'SELECT migration_name, finished_at IS NOT NULL AS done FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;'
" || warn "迁移状态查询失败（可能 postgres 还没起来或库还没建）"

section "6. 管理员账号数"
run "
  cd ${REMOTE_DIR} 2>/dev/null && \
  docker compose -f ${COMPOSE_FILE} exec -T postgres \
    psql -U shenlun -d ${POSTGRES_DB} -t -c \
    'SELECT count(*) AS admin_count FROM \"User\" WHERE role = '\''ADMIN'\'';'
" || warn "管理员查询失败"

echo ""
if [[ "$is_remote" == "1" ]]; then
  ok "检查完成（远程 ${LINUX_HOST}）"
  echo "   Mac 浏览器: http://${LINUX_HOST}:3001"
else
  ok "检查完成（本机）"
  echo "   本机浏览器: http://127.0.0.1:3001"
fi
