#!/usr/bin/env bash
# Bật server + Cloudflare Quick Tunnel trong cùng một terminal.
# Dùng: npm run public   (Ctrl+C để tắt cả hai)
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -x bin/cloudflared ]; then
  echo "✗ Chưa có bin/cloudflared. Tải bằng lệnh:"
  echo "  mkdir -p bin && curl -L -o /tmp/cloudflared.tgz \\"
  echo "    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz \\"
  echo "    && tar -xzf /tmp/cloudflared.tgz -C bin"
  exit 1
fi

SERVER_PID=""
if curl -s --max-time 1 http://localhost:3000/api/health >/dev/null 2>&1; then
  echo "→ Server đã chạy sẵn ở cổng 3000"
else
  echo "→ Đang khởi động server..."
  npm start &
  SERVER_PID=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    curl -s --max-time 1 http://localhost:3000/api/health >/dev/null 2>&1 && break
  done
fi

cleanup() {
  echo
  echo "→ Đang dừng server..."
  [ -n "${SERVER_PID}" ] && kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ Mở Cloudflare Tunnel — copy địa chỉ https://....trycloudflare.com bên dưới"
echo
./bin/cloudflared tunnel --url http://localhost:3000 --no-autoupdate
