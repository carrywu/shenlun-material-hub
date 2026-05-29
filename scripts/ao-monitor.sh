#!/bin/bash

# 简单的 AO 状态监控脚本
# 用法: ./ao-monitor.sh [会话ID]

SESSION_ID="${1:-smh-1}"
REFRESH_INTERVAL=10

echo "监控会话: $SESSION_ID"
echo "刷新间隔: ${REFRESH_INTERVAL}秒"
echo "按 Ctrl+C 退出"
echo "=================================="

while true; do
    clear
    echo "=== AO 状态 ($(date '+%H:%M:%S')) ==="
    ao status 2>/dev/null | grep -A10 "shenlun-material-hub"
    
    echo ""
    echo "=== 会话 $SESSION_ID 最新输出 ==="
    tmux capture-pane -t "$SESSION_ID" -p -S -15 2>/dev/null | tail -10
    
    sleep $REFRESH_INTERVAL
done