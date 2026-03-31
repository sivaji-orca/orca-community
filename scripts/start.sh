#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo "============================================"
echo "  Starting Orca Community Edition"
echo "============================================"
echo ""

MULE_HOME="${MULE_HOME:-$ROOT_DIR/softwares/mule-standalone}"

if [ -d "$MULE_HOME/bin" ]; then
  echo "Starting Mule Runtime..."
  export MULE_HOME
  "$MULE_HOME/bin/mule" start 2>/dev/null && echo "  [OK] Mule Runtime started" || echo "  [INFO] Mule Runtime may already be running"
  sleep 3
else
  echo "  [SKIP] Mule Runtime not found at $MULE_HOME"
fi

echo ""
echo "Starting backend (port 3003)..."
cd "$ROOT_DIR/backend"
nohup bun src/index.ts > "$ROOT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "  [OK] Backend started (PID: $BACKEND_PID)"

echo ""
echo "Starting frontend (port 5173)..."
cd "$ROOT_DIR/frontend"
nohup bun run dev > "$ROOT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "  [OK] Frontend started (PID: $FRONTEND_PID)"

echo "$BACKEND_PID" > "$ROOT_DIR/.pids"
echo "$FRONTEND_PID" >> "$ROOT_DIR/.pids"

echo ""
echo "============================================"
echo "  Orca Community Edition is running!"
echo ""
echo "  Dashboard:  http://localhost:5173"
echo "  Backend:    http://localhost:3003"
echo "============================================"
