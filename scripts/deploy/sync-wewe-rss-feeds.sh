#!/usr/bin/env bash
# sync-wewe-rss-feeds.sh — 从本地 WeWe RSS SQLite 同步公众号到线上实例
#
# 用法：
#   bash scripts/deploy/sync-wewe-rss-feeds.sh                    # 预览
#   bash scripts/deploy/sync-wewe-rss-feeds.sh --apply             # 自动同步
#   bash scripts/deploy/sync-wewe-rss-feeds.sh --apply --remote    # 通过 SSH 在服务器执行
#
# 环境变量：
#   AUTH_CODE    WeWe RSS 管理密码（--apply 模式必须）
#   REMOTE_HOST  线上 WeWe RSS 地址（默认 47.119.182.210）
#   REMOTE_PORT  线上 WeWe RSS 端口（默认 4000）
#   SSH_USER     SSH 用户名（默认 root）
#   SSH_PASS     SSH 密码（--remote 模式需要）
#
# 原理：
#   1. 读取本地 infra/wechat-rss/wewe-rss/data/wewe-rss.db 中的 feeds 表
#   2. 通过 tRPC API 获取线上 WeWe RSS 的 feed 列表
#   3. 对比差异，找出缺失的 feed
#   4. --apply 模式下，通过 tRPC feed.add API 自动添加缺失的 feed
#   5. 非交互模式输出手动添加指南

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
AUTH_CODE="${AUTH_CODE:-}"

APPLY=false
REMOTE_MODE=false
while [ $# -gt 0 ]; do
  case "$1" in
    --apply)  APPLY=true; shift ;;
    --remote) REMOTE_MODE=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--apply] [--remote]"
      echo ""
      echo "Environment variables:"
      echo "  AUTH_CODE    WeWe RSS admin password (required for --apply)"
      echo "  REMOTE_HOST  Remote WeWe RSS host (default: 47.119.182.210)"
      echo "  REMOTE_PORT  Remote WeWe RSS port (default: 4000)"
      echo "  SSH_USER     SSH user (default: root)"
      echo "  SSH_PASS     SSH password (for --remote mode)"
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

# 读取本地 feeds（完整字段）
LOCAL_FEEDS=$(sqlite3 "$LOCAL_DB" "SELECT id || '|' || mp_name || '|' || COALESCE(mp_cover,'') || '|' || COALESCE(mp_intro,'') || '|' || COALESCE(update_time,0) FROM feeds WHERE status = 1;")
LOCAL_COUNT=$(echo "$LOCAL_FEEDS" | wc -l | tr -d ' ')

log "本地公众号: ${LOCAL_COUNT} 个"
echo ""

echo "本地公众号列表:"
echo "─────────────────────────────────────────────"
echo "$LOCAL_FEEDS" | while IFS='|' read -r id name _; do
  printf "  %-35s %s\n" "$id" "$name"
done
echo ""

# ── 获取线上 feeds（tRPC API）────────────────────────────────────────────────

log "获取线上 WeWe RSS 公众号列表..."

if [ "$REMOTE_MODE" = true ] && [ -n "$SSH_PASS" ]; then
  REMOTE_FEEDS_JSON=$(sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${REMOTE_HOST}" \
    "curl -s 'http://localhost:${REMOTE_PORT}/trpc/feed.list?input=%7B%7D' -H 'Authorization: ${AUTH_CODE}'" 2>/dev/null || echo '{"result":{"data":{"items":[]}}}')
else
  REMOTE_FEEDS_JSON=$(curl -s "${REMOTE_URL}/trpc/feed.list?input=%7B%7D" \
    -H "Authorization: ${AUTH_CODE}" 2>/dev/null || echo '{"result":{"data":{"items":[]}}}')
fi

# 提取线上 feed IDs
REMOTE_IDS=$(echo "$REMOTE_FEEDS_JSON" | python3 -c "
import sys, json
try:
    feeds = json.load(sys.stdin).get('result', {}).get('data', {}).get('items', [])
    for f in feeds:
        print(f.get('id', ''))
except:
    pass
" 2>/dev/null)

REMOTE_COUNT=$(echo "$REMOTE_IDS" | grep -c . 2>/dev/null || echo 0)
log "线上公众号: ${REMOTE_COUNT} 个"

# ── 对比差异 ──────────────────────────────────────────────────────────────────

MISSING_FILE=$(mktemp)
echo "$LOCAL_FEEDS" | while IFS='|' read -r id name _; do
  if ! echo "$REMOTE_IDS" | grep -q "^${id}$" 2>/dev/null; then
    echo "$LOCAL_FEEDS" | grep "^${id}|" >> "$MISSING_FILE"
  fi
done

# 去重（以防万一）
MISSING_FILE_UNIQUE=$(mktemp)
sort -u -o "$MISSING_FILE_UNIQUE" "$MISSING_FILE"
mv "$MISSING_FILE_UNIQUE" "$MISSING_FILE"

MISSING=$(wc -l < "$MISSING_FILE" | tr -d ' ')

echo ""
echo "$LOCAL_FEEDS" | while IFS='|' read -r id name _; do
  if echo "$REMOTE_IDS" | grep -q "^${id}$" 2>/dev/null; then
    printf "  ✅ 已存在: %s (%s)\n" "$name" "$id"
  else
    printf "  ❌ 缺少:   %s (%s)\n" "$name" "$id"
  fi
done
echo ""

if [ "$MISSING" -eq 0 ]; then
  log "✅ 线上已包含所有本地公众号，无需同步"
  rm -f "$MISSING_FILE"
  exit 0
fi

log "需要同步: ${MISSING} 个公众号"

# ── 自动同步模式（--apply）────────────────────────────────────────────────────

if [ "$APPLY" = true ]; then
  if [ -z "$AUTH_CODE" ]; then
    die "--apply 模式需要 AUTH_CODE 环境变量: AUTH_CODE='密码' bash $0 --apply"
  fi

  log "开始通过 tRPC API 自动同步..."

  SUCCESS=0
  FAIL=0

  while IFS='|' read -r id name cover intro update_time; do
    # 构建 JSON payload（使用 python3 避免转义问题）
    PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
    'id': sys.argv[1],
    'mpName': sys.argv[2],
    'mpCover': sys.argv[3],
    'mpIntro': sys.argv[4],
    'updateTime': int(sys.argv[5]) if sys.argv[5] else 0
}, ensure_ascii=False))
" "$id" "$name" "$cover" "$intro" "$update_time")

    if [ "$REMOTE_MODE" = true ] && [ -n "$SSH_PASS" ]; then
      RESULT=$(sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=accept-new "${SSH_USER}@${REMOTE_HOST}" \
        "curl -s 'http://localhost:${REMOTE_PORT}/trpc/feed.add' -X POST -H 'Content-Type: application/json' -H 'Authorization: ${AUTH_CODE}' -d '${PAYLOAD}'" 2>/dev/null)
    else
      RESULT=$(curl -s --connect-timeout 10 "${REMOTE_URL}/trpc/feed.add" \
        -X POST \
        -H "Authorization: ${AUTH_CODE}" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" 2>/dev/null)
    fi

    # 检查结果
    IS_OK=$(echo "$RESULT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'result' in d:
        print('ok')
    else:
        msg = d.get('error', {}).get('message', 'unknown')
        print(f'fail:{msg[:80]}')
except Exception as e:
    print(f'fail:{e}')
" 2>/dev/null)

    if [ "$IS_OK" = "ok" ]; then
      printf "  ✅ 已添加: %s (%s)\n" "$name" "$id"
      SUCCESS=$((SUCCESS + 1))
    else
      REASON="${IS_OK#fail:}"
      printf "  ❌ 失败:   %s (%s) — %s\n" "$name" "$id" "$REASON"
      FAIL=$((FAIL + 1))
    fi
  done < "$MISSING_FILE"

  echo ""
  log "同步完成: ✅ ${SUCCESS} 成功, ❌ ${FAIL} 失败"
  rm -f "$MISSING_FILE"
  exit 0
fi

# ── 预览模式：生成手动同步指南 ────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  公众号同步指南"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "方式一：自动同步（推荐）"
echo "  AUTH_CODE='<密码>' bash scripts/deploy/sync-wewe-rss-feeds.sh --apply"
echo ""
echo "方式二：手动添加"
echo "  1. 打开 ${REMOTE_URL}"
echo "  2. 输入 AUTH_CODE 登录"
echo "  3. 搜索并添加以下公众号："
echo ""

cat "$MISSING_FILE" | while IFS='|' read -r id name _; do
  printf "   • %s (ID: %s)\n" "$name" "$id"
done

echo ""
echo "═══════════════════════════════════════════════════════"

rm -f "$MISSING_FILE"

log "DRY-RUN 模式 — 使用 --apply 参数实际执行同步"
