#!/usr/bin/env bash
# 在 Cursor 編輯器內的 Simple Browser 分頁開啟網址（非外部瀏覽器）
set -euo pipefail

URL="${1:-http://127.0.0.1:3000/}"
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${URL}''', safe=''))")
VSCODE_URL="vscode://vscode/simple-browser/show?url=${ENCODED}"

CURSOR_BIN="${CURSOR_BIN:-/Applications/Cursor.app/Contents/Resources/app/bin/cursor}"

echo "Cursor 內嵌瀏覽器：${URL}"

if [ -x "$CURSOR_BIN" ]; then
  "$CURSOR_BIN" --open-url "$VSCODE_URL" >/dev/null 2>&1 || true
fi

echo ""
echo "若未自動出現內嵌頁，請在 Cursor 按 Cmd+Shift+P → 輸入 Simple Browser: Show → 貼上："
echo "${URL}"
