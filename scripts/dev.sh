#!/bin/bash
#
# 本地开发一键启动脚本
#
# 做三件事：
#   1. 确保 Postgres 容器在跑（没起就自动起）
#   2. 跑一遍 prisma migrate deploy（确保 schema 最新）
#   3. 启动 pnpm dev（前台运行，Ctrl+C 退出）
#
# 用法:
#   ./scripts/dev.sh           # 默认行为，启动后停在 dev server
#   ./scripts/dev.sh --no-db   # 跳过数据库相关步骤，只起 dev server
#
# 端口被占用时会交互式询问：复用 / 杀掉重启 / 退出。
#
set -euo pipefail

# ---- 定位项目根目录（脚本可在任意目录调用）----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# ---- 颜色输出 ----
info()  { printf "\033[36m[dev]\033[0m %s\n" "$*"; }
warn()  { printf "\033[33m[dev]\033[0m %s\n" "$*"; }
error() { printf "\033[31m[dev]\033[0m %s\n" "$*" >&2; }

# ---- 读取端口配置（与 run-next.mjs 保持一致，避免硬编码）----
PORT="3001"
HOSTNAME="0.0.0.0"
CONFIG_FILE="$ROOT_DIR/config/server.config.json"
if [ -f "$CONFIG_FILE" ]; then
  # 仅在系统有 node 时尝试解析 JSON；失败则回退默认值
  if command -v node >/dev/null 2>&1; then
    PORT="$(node -e "try{console.log(require('$CONFIG_FILE').port||3001)}catch{console.log(3001)}" 2>/dev/null || echo 3001)"
    HOSTNAME="$(node -e "try{console.log(require('$CONFIG_FILE').hostname||'0.0.0.0')}catch{console.log('0.0.0.0')}" 2>/dev/null || echo 0.0.0.0)"
  fi
fi

# ---- 解析参数 ----
SKIP_DB=0
for arg in "$@"; do
  case "$arg" in
    --no-db) SKIP_DB=1 ;;
    *) warn "未知参数: $arg（已忽略）" ;;
  esac
done

# ---- 步骤 1：确保依赖已安装 ----
if [ ! -d "node_modules" ]; then
  info "未检测到 node_modules，开始安装依赖..."
  pnpm install
fi

# ---- 步骤 2：确保 Postgres 容器在跑 + 迁移最新 ----
if [ "$SKIP_DB" -eq 0 ]; then
  # 判断 docker-compose.yml 里是否定义了 postgres 服务
  if ! grep -q "^  postgres:" docker-compose.yml 2>/dev/null; then
    warn "docker-compose.yml 中未找到 postgres 服务，跳过数据库步骤"
  else
    info "检查 Postgres 容器状态..."
    if ! docker compose ps postgres 2>/dev/null | grep -q "healthy\|running"; then
      info "Postgres 未运行，启动中..."
      docker compose up -d postgres
      # 等待健康检查通过（最多 30 秒）
      info "等待 Postgres 就绪..."
      for i in $(seq 1 30); do
        if docker compose ps postgres 2>/dev/null | grep -q "healthy"; then
          break
        fi
        sleep 1
      done
    else
      info "Postgres 已在运行"
    fi

    info "应用数据库迁移..."
    pnpm exec prisma migrate deploy
  fi
else
  warn "已跳过数据库相关步骤（--no-db）"
fi

# ---- 步骤 3：启动 dev server（前台）----
# 检查端口是否已被占用，占用时交互式询问处理方式
PORT_PID=""
if command -v lsof >/dev/null 2>&1; then
  PORT_PID="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n1 || true)"
fi

if [ -n "$PORT_PID" ]; then
  # 尝试拿到占用进程的可读信息（命令行）
  PORT_CMD="$(ps -p "$PORT_PID" -o command= 2>/dev/null | head -c 120 || echo "未知进程")"
  echo ""
  warn "端口 $PORT 已被占用："
  echo "    PID: $PORT_PID"
  echo "    命令: $PORT_CMD"
  echo ""
  echo "请选择处理方式："
  echo "  [r] 复用现有服务（推荐，不重启）"
  echo "  [k] 杀掉该进程并重新启动"
  echo "  [q] 退出，什么都不做"
  echo ""
  while true; do
    printf "\033[36m[dev]\033[0m 选择 [r/k/q]: " >&2
    read -r choice </dev/tty
    case "$choice" in
      r|R)
        info "复用现有服务，退出脚本。浏览器访问 http://localhost:$PORT 即可。"
        exit 0
        ;;
      k|K)
        info "杀掉进程 $PORT_PID ..."
        if kill "$PORT_PID" 2>/dev/null; then
          # 等待端口真正释放（最多 10 秒）
          for _ in $(seq 1 10); do
            if [ -z "$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)" ]; then
              break
            fi
            sleep 1
          done
          info "进程已停止，端口已释放"
        else
          error "杀进程失败，可能需要权限。请手动执行: kill $PORT_PID"
          exit 1
        fi
        break
        ;;
      q|Q|"")
        info "已取消，退出。"
        exit 0
        ;;
      *)
        warn "无效输入，请输入 r / k / q"
        ;;
    esac
  done
fi

info "启动开发服务器..."
info "提示：按 Ctrl+C 停止。Postgres 容器会继续在后台运行（可用 docker compose stop postgres 停止）"
echo "=================================="
pnpm dev
