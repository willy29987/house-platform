#!/usr/bin/env bash
# 內網 dev + 自動同步 Cursor 內嵌預覽網址
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/sync-lan-preview-urls.mjs --watch &
SYNC_PID=$!

cleanup() {
  kill "$SYNC_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

exec npx next dev --hostname 0.0.0.0 --port "${PORT:-3000}"
