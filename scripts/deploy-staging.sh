#!/usr/bin/env bash
# ============================================================
# Staging 测试环境部署脚本（经过实战验证）
# ============================================================
#
# 两种运行模式：
#   1) 在 Linux 测试机上本机执行（推荐）：
#        bash scripts/deploy-staging.sh
#   2) 从 Mac 远程触发（需先配好 ssh 公钥免密）：
#        LINUX_HOST=100.117.96.1 bash scripts/deploy-staging.sh
#
# 本脚本修复的 5 个真实坑（详见各步骤注释）：
#   A. docker compose 文件 ${VAR} 插值需要 shell 环境变量，--env-file 只给容器内用
#   B. fresh clone 缺 src/generated/prisma，build 前必须 prisma generate
#   C. standalone runner 镜像无 wget，healthcheck 用 node（compose override）
#   D. standalone runner 无 tsx，seed-admin 在 host 跑会撞 Prisma 7 入口；改在 postgres 容器 psql INSERT
#   E. Docker Desktop 环境：docker context use desktop-linux
#
set -euo pipefail

# ---------- 配置 ----------
LINUX_HOST="${LINUX_HOST:-}"
LINUX_USER="${LINUX_USER:-carry}"
REMOTE_DIR="${REMOTE_DIR:-/home/carry/shenlun-material-hub-staging}"
REMOTE_GIT_URL="${REMOTE_GIT_URL:-https://github.com/carrywu/shenlun-material-hub}"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE=".env.staging"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5433}"
POSTGRES_DB_DEFAULT="shenlun_material_hub"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
die()  { echo -e "${RED}❌${NC} $*" >&2; exit 1; }

is_remote=0
[[ -n "${LINUX_HOST}" ]] && is_remote=1

# 远程命令的公共前置：PATH(pnpm) + 代理 + docker context + cd 项目目录 + 加载 .env.staging 到 shell
# （坑 A：compose 文件插值需要 shell env；坑 E：docker context）
PRELUDE='export PATH="$HOME/.local/bin:$PATH"
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897
docker context use desktop-linux >/dev/null 2>&1 || true
cd '"${REMOTE_DIR}"' || { echo "❌ 目录不存在"; exit 1; }
set -a; source .env.staging 2>/dev/null || { echo "❌ .env.staging 不存在或加载失败"; exit 1; }; set +a
'

run() {
  if [[ "$is_remote" == "1" ]]; then
    ssh -o BatchMode=yes "${LINUX_USER}@${LINUX_HOST}" "bash -s" <<EOF
${PRELUDE}
$1
EOF
  else
    bash -c "${PRELUDE}
$1"
  fi
}

# ---------- 0. 前置 ----------
log "目标：${LINUX_USER}@${LINUX_HOST:-<本机>}:${REMOTE_DIR}"
[[ "$is_remote" == "1" ]] && log "(远程模式)" || log "(本机模式)"

# ---------- 1. 校验 .env.staging ----------
log "校验 ${ENV_FILE}"
run '
  test -f ${ENV_FILE} || { echo "❌ ${ENV_FILE} 不存在，请: cp .env.staging.example .env.staging 并填写"; exit 1; }
  for k in POSTGRES_PASSWORD ADMIN_PASSWORD AI_CONFIG_ENCRYPTION_KEY JWT_SECRET; do
    v=$(grep "^${k}=" ${ENV_FILE} | cut -d= -f2-)
    if [[ -z "$v" || "$v" == *"填写"* || "$v" == *"PASSWORD"* ]]; then
      echo "❌ ${k} 仍是占位符"; exit 1
    fi
  done
  echo "✓ env 校验通过"
' || die "env 校验失败"

# ---------- 2. git pull ----------
log "git pull"
run '
  if [[ ! -d .git ]]; then
    git clone '"${REMOTE_GIT_URL}"' .
  fi
  git pull --ff-only
' || die "git pull 失败"

# ---------- 3. host 端 prisma generate（坑 B：fresh clone 缺 generated client）----------
log "host 端 prisma generate（build 前必需，src/generated/prisma 在 .gitignore 里）"
run '
  [[ -d node_modules ]] || pnpm install --frozen-lockfile
  npx prisma generate >/dev/null 2>&1 && echo "✓ prisma client 已生成" || { echo "❌ prisma generate 失败"; exit 1; }
' || die "prisma generate 失败"

# ---------- 4. docker build ----------
log "docker compose build"
run 'docker compose -f ${COMPOSE_FILE} build' || die "build 失败"

# ---------- 5. up postgres ----------
log "启动 postgres"
run 'docker compose -f ${COMPOSE_FILE} up -d --wait postgres' || die "postgres 启动失败"

# ---------- 6. migrate（app 容器内；坑 A 已由 source .env.staging 解决插值）----------
log "prisma migrate deploy"
run 'docker compose -f ${COMPOSE_FILE} exec -T app npx prisma migrate deploy' || die "迁移失败"
ok "迁移完成"

# ---------- 7. seed-admin（坑 D：standalone 镜像无 tsx，改用 postgres 容器 psql INSERT）----------
log "seed-admin（psql 幂等插入）"
run '
  # 已存在管理员则跳过
  EXISTS=$(docker compose -f ${COMPOSE_FILE} exec -T postgres psql -U shenlun -d '"${POSTGRES_DB_DEFAULT}"' -t -c "SELECT count(*) FROM \"User\" WHERE username='\''${ADMIN_USERNAME}'\'';" 2>/dev/null | tr -d "[:space:]")
  if [[ "$EXISTS" == "0" || -z "$EXISTS" ]]; then
    # 生成 bcrypt hash（容器内有 node + bcryptjs）
    HASH=$(docker compose -f ${COMPOSE_FILE} exec -T app node -e "const b=require(\"bcryptjs\");b.hash(\"${ADMIN_PASSWORD}\",12).then(h=>console.log(h))" 2>/dev/null | tr -d "[:space:]")
    if [[ -z "$HASH" || "$HASH" != \$2* ]]; then
      echo "⚠ bcrypt hash 生成失败，跳过 seed（后续可手动建管理员）"
    else
      docker compose -f ${COMPOSE_FILE} exec -T postgres psql -U shenlun -d '"${POSTGRES_DB_DEFAULT}"' -c "INSERT INTO \"User\" (id, username, \"displayName\", \"passwordHash\", role, status, \"createdAt\", \"updatedAt\") VALUES (gen_random_uuid()::text, '\''${ADMIN_USERNAME}'\'', '\''管理员'\'', '\''${HASH}'\'', '\''ADMIN'\'', '\''ACTIVE'\'', NOW(), NOW());" >/dev/null 2>&1 && echo "✓ 管理员 ${ADMIN_USERNAME} 已创建" || echo "⚠ seed 插入失败（看 psql 错误）"
    fi
  else
    echo "✓ 管理员 ${ADMIN_USERNAME} 已存在，跳过"
  fi
' || warn "seed-admin 环节有警告（非致命）"

# ---------- 8. up app + we-mp-rss ----------
log "启动 app + we-mp-rss"
run 'docker compose -f ${COMPOSE_FILE} up -d' || die "app/we-mp-rss 启动失败"

# ---------- 9. 等 app 健康（坑 C：healthcheck 已用 node override）----------
log "等待 app 健康"
run '
  for i in $(seq 1 20); do
    s=$(docker inspect --format="{{.State.Health.Status}}" shenlun-staging-app 2>/dev/null || echo none)
    if [[ "$s" == "healthy" ]]; then echo "✓ app healthy (第 ${i} 次)"; exit 0; fi
    sleep 5
  done
  echo "⚠ app 60s 内未 healthy，状态: $s，看 docker compose logs app"
  exit 1
' || warn "app 未在预期内健康（继续，可能只是慢）"

# ---------- 10. 健康检查脚本 ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "${SCRIPT_DIR}/check-staging.sh" ]]; then
  log "运行 check-staging.sh"
  if [[ "$is_remote" == "1" ]]; then
    LINUX_HOST=${LINUX_HOST} bash "${SCRIPT_DIR}/check-staging.sh" || warn "check-staging 有警告"
  else
    bash "${SCRIPT_DIR}/check-staging.sh" || warn "check-staging 有警告"
  fi
fi

echo ""
ok "Staging 部署完成"
echo "   Linux 本机:  http://127.0.0.1:3001"
echo "   Mac Tailscale: http://${LINUX_HOST:-100.117.96.1}:3001"
echo "   we-mp-rss:    http://${LINUX_HOST:-100.117.96.1}:8001"
echo "   health:       curl http://${LINUX_HOST:-100.117.96.1}:3001/api/health"
