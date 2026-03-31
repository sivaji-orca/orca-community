#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Stopping Orca Community Edition"
echo "============================================"
echo ""

echo "Stopping backend and frontend..."
lsof -ti:3003 | xargs kill -9 2>/dev/null && echo "  [OK] Backend stopped" || echo "  [OK] Backend was not running"
lsof -ti:5173 | xargs kill -9 2>/dev/null && echo "  [OK] Frontend stopped" || echo "  [OK] Frontend was not running"

MULE_HOME="${MULE_HOME:-$ROOT_DIR/softwares/mule-standalone}"
if [ -d "$MULE_HOME/bin" ]; then
  echo ""
  echo "Stopping Mule Runtime..."
  export MULE_HOME
  "$MULE_HOME/bin/mule" stop 2>/dev/null && echo "  [OK] Mule Runtime stopped" || echo "  [OK] Mule Runtime was not running"
fi

rm -f "$ROOT_DIR/.pids"

echo ""
echo "============================================"
echo "  All services stopped."
echo "============================================"
