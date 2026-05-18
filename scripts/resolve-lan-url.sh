#!/usr/bin/env bash
# 輸出內網預覽網址（供 Cursor Task input 使用）
set -euo pipefail

PATH_SUFFIX="${1:-/}"
PORT="${PORT:-3000}"
ENCODED_PATH=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${PATH_SUFFIX}'''))")
API="http://127.0.0.1:${PORT}/api/dev/preview-urls?path=${ENCODED_PATH}"

JSON=$(curl -sf --max-time 3 "$API" 2>/dev/null) || {
  echo "（請先 npm run dev 或 npm run dev:lan）" >&2
  echo "http://127.0.0.1:${PORT}${PATH_SUFFIX}"
  exit 0
}

python3 -c "
import json, sys
d = json.load(sys.stdin)
lan = d.get('lan') or []
if lan:
    print(lan[0])
else:
    print(d.get('localhost', ''), file=sys.stderr)
    print('（內網 IP 為空：請改跑 npm run dev:lan）', file=sys.stderr)
    print(d.get('localhost', ''))
" <<<"$JSON"
