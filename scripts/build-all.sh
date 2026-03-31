#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Orca Community Edition — Build All APIs"
echo "============================================"
echo ""

APIS=(
  "customer-mock-service"
  "customer-management-api"
  "customer-sf-sapi"
  "customer-papi"
)

for api in "${APIS[@]}"; do
  API_DIR="$ROOT_DIR/projects/$api"
  if [ -d "$API_DIR" ]; then
    echo "Building $api..."
    cd "$API_DIR" && mvn clean package -DskipTests -q
    echo "  [OK] $api built successfully"
  else
    echo "  [SKIP] $api directory not found"
  fi
done

echo ""
echo "============================================"
echo "  All APIs built! Run ./scripts/start.sh"
echo "============================================"
