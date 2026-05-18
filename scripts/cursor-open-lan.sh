#!/usr/bin/env bash
# 在 Cursor「內嵌瀏覽器」開啟內網網址（需 npm run dev:lan）
set -euo pipefail

PATH_SUFFIX="${1:-/}"
URL=$(bash "$(dirname "$0")/resolve-lan-url.sh" "$PATH_SUFFIX")
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${URL}''', safe=''))")

CURSOR_BIN="${CURSOR_BIN:-/Applications/Cursor.app/Contents/Resources/app/bin/cursor}"
VSCODE_URL="vscode://vscode/simple-browser/show?url=${ENCODED}"

if [ -x "$CURSOR_BIN" ]; then
  echo "內嵌開啟：$URL"
  exec "$CURSOR_BIN" --open-url "$VSCODE_URL"
fi

echo "請在 Cursor 內：Cmd+Shift+P → Simple Browser: Show"
echo "$URL"
