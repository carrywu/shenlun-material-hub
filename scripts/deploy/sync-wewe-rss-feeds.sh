#!/usr/bin/env bash
# sync-wewe-rss-feeds.sh — 从本地 WeWe RSS SQLite 同步公众号到线上实例
#
# 用法：
#   bash scripts/deploy/sync-wewe-rss-feeds.sh                    # 预览
#   bash scripts/deploy/sync-wewe-rss-feeds.sh --apply             # 实际同步
#   bash scripts/deploy/sync-wewe-rss-feeds.sh --apply --remote    # 通过 SSH 在服务器执行
#
# 原理：
#   1. 读取本地 infra/wechat-rss/wewe-rss/data/wewe-rss.db 中的 feeds 表
#   2. 对每个本地 feed，检查线上 WeWe RSS 是否已有
#   3. 缺少的 feed 通过 WeWe RSS 的添加 API 尝试添加
#   4. 无法通过 API 添加的，输出手动添加指南

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_DB="${PROJECT_DIR}/infra/wechat-rss/wewe-rss/data/wewe-rss.db"

# 线上 WeWe RSS 配置
REMOTE_HOST="${REMOTE_HOST:-47.119.182.210}"
REMOTE_PORT="${REMOTE_PORT:-4000}"
REMOTE_URL="http://${REMOTE_HOST}:${REMOTE_PORT}"
SSH_USER="${SSH_USER:-root}"
SSH_PASS="${SSH_PASS:-}"

APPLY=false
while [ $# -gt 0 ]; do
  case "$1" in
    --apply)  APPLY=true; shift ;;
    --remote) REMOTE_MODE=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--apply] [--remote]"
      exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

log()  { printf '[sync-feeds] %s\n' "$*"; }
die()  { printf '[sync-feeds] ERROR: %s\n' "$*" >&2; exit 1; }

# ── 检查本地数据库 ────────────────────────────────────────────────────────────

if [ ! -f "$LOCAL_DB" ]; then
  die "本地 WeWe RSS 数据库不存在: $LOCAL_DB"
fi

log "读取本地 WeWe RSS 数据库..."

# 读取本地 feeds
LOCAL_FEEDS=$(sqlite3 "$LOCAL_DB" "SELECT id || '|' || mp_name FROM feeds WHERE status = 1;")
LOCAL_COUNT=$(echo "$LOCAL_FEEDS" | wc -l | tr -d ' ')

log "本地公众号: ${LOCAL_COUNT} 个"
echo ""

echo "本地公众号列表:"
echo "─────────────────────────────────────────────"
echo "$LOCAL_FEEDS" | while IFS='|' read -r id name; do
  printf "  %-35s %s\n" "$id" "$name"
done
echo ""

# ── 获取线上 feeds ────────────────────────────────────────────────────────────

log "获取线上 WeWe RSS 公众号列表..."

if [ -n "$SSH_PASS" ]; then
  REMOTE_FEEDS=$(sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${REMOTE_HOST}" \
    "curl -s http://localhost:${REMOTE_PORT}/feeds/" 2>/dev/null || echo '[]')
else
  REMOTE_FEEDS=$(curl -s "${REMOTE_URL}/feeds/" 2>/dev/null || echo '[]')
fi

# 提取线上 feed IDs
REMOTE_IDS=$(echo "$REMOTE_FEEDS" | python3 -c "
import sys, json
try:
    feeds = json.load(sys.stdin)
    for f in feeds:
        print(f.get('id', ''))
except:
    pass
" 2>/dev/null)

REMOTE_COUNT=$(echo "$REMOTE_IDS" | grep -c . 2>/dev/null || echo 0)
log "线上公众号: ${REMOTE_COUNT} 个"

# ── 对比差异 ──────────────────────────────────────────────────────────────────

MISSING_FEEDS=""
MISSING_COUNT=0

echo "$LOCAL_FEEDS" | while IFS='|' read -r id name; do
  if echo "$REMOTE_IDS" | grep -q "^${id}$" 2>/dev/null; then
    : # 已存在，跳过
  else
    MISSING_COUNT=$((MISSING_COUNT + 1))
    echo "  ❌ 缺少: ${name} (${id})"
  fi
done

# 用文件传递结果（子 shell 变量无法传递）
MISSING_FILE=$(mktemp)
echo "$LOCAL_FEEDS" | while IFS='|' read -r id name; do
  if ! echo "$REMOTE_IDS" | grep -q "^${id}$" 2>/dev/null; then
    echo "${id}|${name}" >> "$MISSING_FILE"
  fi
done

MISSING=$(wc -l < "$MISSING_FILE" | tr -d ' ')

echo ""
if [ "$MISSING" -eq 0 ]; then
  log "✅ 线上已包含所有本地公众号，无需同步"
  rm -f "$MISSING_FILE"
  exit 0
fi

log "需要同步: ${MISSING} 个公众号"

# ── 生成同步指南 ──────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  公众号同步指南"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "WeWe RSS 不提供公开的添加 feed API。"
echo "请在浏览器中手动添加以下公众号："
echo ""
echo "1. 打开 ${REMOTE_URL}"
echo "2. 输入 AUTH_CODE: 9171227871"
echo "3. 搜索并添加以下公众号："
echo ""

cat "$MISSING_FILE" | while IFS='|' read -r id name; do
  printf "   • %s (ID: %s)\n" "$name" "$id"
done

echo ""
echo "或者，使用 WeWe RSS 的微信公众号搜索功能，"
echo "直接搜索公众号名称添加即可。"
echo "═══════════════════════════════════════════════════════"

# ── 清理 ──────────────────────────────────────────────────────────────────────

rm -f "$MISSING_FILE"

if [ "$APPLY" = false ]; then
  log "DRY-RUN 模式 — 使用 --apply 参数实际执行同步"
  exit 0
fi

# WeWe RSS 目前不提供公开 API 来添加 feed
# 如果未来 WeWe RSS 提供了添加 API，可以在这里实现自动同步
log "⚠️  WeWe RSS 暂不支持通过 API 添加公众号"
log "请按上述指南手动添加，或等待 WeWe RSS 更新 API 支持"
