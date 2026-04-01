#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Orca Community Edition Setup"
echo "  MuleSoft Productivity Tool"
echo "============================================"
echo ""

# --- 1. Check prerequisites ---
check_prereq() {
  local cmd="$1" label="${2:-$1}"
  if command -v "$cmd" &>/dev/null; then
    local ver
    ver=$($cmd --version 2>/dev/null | head -1)
    echo "  [OK] $label found: $ver"
  else
    echo "  [MISSING] $label is required. See README.md for install instructions."
    MISSING=1
  fi
}

MISSING=0
echo "Step 1/5: Checking prerequisites..."
echo ""
check_prereq bun "Bun (JavaScript runtime)"
check_prereq mvn "Maven (build tool)"
check_prereq java "Java"
check_prereq git "Git"
echo ""

if [ "$MISSING" -eq 1 ]; then
  echo "  Some prerequisites are missing. Install them and re-run this script."
  echo "  See README.md > Prerequisites for install links."
  exit 1
fi

echo "  Optional tools:"
if command -v sf &>/dev/null; then
  echo "  [OK] Salesforce CLI found: $(sf --version 2>/dev/null | head -1)"
else
  echo "  [INFO] Salesforce CLI not found (optional — needed only for SF org management)"
fi

# Java version check
JAVA_VER=$(java -version 2>&1 | head -1)
if echo "$JAVA_VER" | grep -q '"1[0-6]\.' 2>/dev/null; then
  echo "  [WARNING] Java 17+ is required. You appear to have an older version."
  echo "  Detected: $JAVA_VER"
  echo ""
fi

# --- 2. Check Maven settings.xml ---
echo "Step 2/5: Checking Maven configuration..."
echo ""
SETTINGS_XML="$HOME/.m2/settings.xml"

if [ -f "$SETTINGS_XML" ]; then
  if grep -q "anypoint-exchange-v3" "$SETTINGS_XML" 2>/dev/null; then
    echo "  [OK] ~/.m2/settings.xml found with Anypoint Exchange credentials"
  else
    echo "  [WARNING] ~/.m2/settings.xml exists but missing Anypoint Exchange server entry."
    echo "  The Mule runtime auto-download and Exchange publishing require it."
    echo "  Run ./scripts/configure.sh after filling in config.yaml to auto-fix this."
  fi
else
  echo "  [INFO] ~/.m2/settings.xml not found."
  echo "  It will be auto-created when you run ./scripts/configure.sh"
fi
echo ""

# --- 3. Install dependencies ---
echo "Step 3/5: Installing dependencies..."
echo ""

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

cd "$ROOT_DIR/backend" && bun install --silent
echo "  [OK] Backend dependencies installed"

cd "$ROOT_DIR/frontend" && bun install --silent
echo "  [OK] Frontend dependencies installed"
echo ""

# --- 4. Create config files and seed database ---
echo "Step 4/5: Configuration files and database..."
echo ""

if [ ! -f "$ROOT_DIR/config.yaml" ]; then
  cp "$ROOT_DIR/config.template.yaml" "$ROOT_DIR/config.yaml"
  echo "  [OK] config.yaml created from template."
  echo "  >>> ACTION REQUIRED: Edit config.yaml with your organization's credentials."
  echo "  >>> Then run: ./scripts/configure.sh"
else
  echo "  [OK] config.yaml already exists"
fi

if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
  echo "  [OK] backend/.env created from template"
else
  echo "  [OK] backend/.env already exists"
fi

echo "  Seeding default users..."
cd "$ROOT_DIR/backend" && bun src/db/seed.ts 2>/dev/null || echo "  [INFO] Seed skipped (may already be seeded)"
echo ""

# --- 5. Download Mule Runtime (auto via Maven) ---
echo "Step 5/5: Mule Runtime..."
echo ""

MULE_HOME="$ROOT_DIR/softwares/mule-standalone"
MULE_VERSION="4.11.2"

if [ -d "$MULE_HOME/bin" ]; then
  echo "  [OK] Mule Runtime $MULE_VERSION already installed at $MULE_HOME"
else
  echo "  Mule Runtime not found. Attempting auto-download via Maven..."
  echo ""

  if ! grep -q "mulesoft-releases\|mulesoft-public\|repository.mulesoft.org" "$SETTINGS_XML" 2>/dev/null; then
    echo "  [ERROR] Maven settings.xml is missing MuleSoft repository configuration."
    echo "  Cannot auto-download the Mule Runtime."
    echo ""
    echo "  To fix this:"
    echo "    1. Fill in config.yaml with your Anypoint client_id and client_secret"
    echo "    2. Run: ./scripts/configure.sh   (this will create settings.xml for you)"
    echo "    3. Re-run: ./scripts/setup.sh"
    echo ""
    echo "  Or manually download Mule EE $MULE_VERSION standalone from:"
    echo "    https://www.mulesoft.com/lp/dl/mule-esb-enterprise"
    echo "  and extract to: $MULE_HOME/"
  else
    mkdir -p "$ROOT_DIR/softwares"
    MULE_ZIP="$ROOT_DIR/softwares/mule-ee-distribution-standalone-${MULE_VERSION}.zip"

    echo "  Downloading Mule EE $MULE_VERSION standalone (~308 MB)..."
    echo "  This is a one-time download. Maven will cache it for future use."
    echo ""

    mvn dependency:copy \
      -Dartifact="com.mulesoft.mule.distributions:mule-ee-distribution-standalone:${MULE_VERSION}:zip" \
      -DoutputDirectory="$ROOT_DIR/softwares" \
      -Dmdep.stripVersion=false \
      -q 2>&1 || {
        echo ""
        echo "  [ERROR] Maven download failed. Possible causes:"
        echo "    - Missing or invalid Anypoint credentials in ~/.m2/settings.xml"
        echo "    - No internet connection"
        echo "    - Mule EE version $MULE_VERSION not available in your MuleSoft account"
        echo ""
        echo "  Try running ./scripts/configure.sh to fix Maven settings,"
        echo "  or manually download from: https://www.mulesoft.com/lp/dl/mule-esb-enterprise"
        exit 1
      }

    if [ -f "$MULE_ZIP" ]; then
      echo "  [OK] Downloaded. Extracting..."
      cd "$ROOT_DIR/softwares"
      unzip -q "$MULE_ZIP"

      EXTRACTED_DIR=$(ls -d mule-enterprise-standalone-* 2>/dev/null | head -1)
      if [ -n "$EXTRACTED_DIR" ]; then
        mv "$EXTRACTED_DIR" mule-standalone
      fi

      echo "  [OK] Mule Runtime extracted to $MULE_HOME"

      WRAPPER_CONF="$MULE_HOME/conf/wrapper.conf"
      if [ -f "$WRAPPER_CONF" ]; then
        if ! grep -q "mule.env" "$WRAPPER_CONF"; then
          LAST_NUM=$(grep -o 'wrapper\.java\.additional\.[0-9]*' "$WRAPPER_CONF" | grep -o '[0-9]*$' | sort -n | tail -1)
          NEXT_NUM=$((LAST_NUM + 1))
          echo "" >> "$WRAPPER_CONF"
          echo "# Orca Community: set environment for config file selection" >> "$WRAPPER_CONF"
          echo "wrapper.java.additional.${NEXT_NUM}=-Dmule.env=local" >> "$WRAPPER_CONF"
          echo "  [OK] Configured wrapper.conf with -Dmule.env=local"
        fi
      fi

      rm -f "$MULE_ZIP"
      echo "  [OK] Cleaned up ZIP archive"
    else
      echo "  [ERROR] Download completed but ZIP not found at expected path."
      echo "  Check $ROOT_DIR/softwares/ for the downloaded file."
    fi
  fi
fi

echo ""
echo "============================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit config.yaml with your credentials"
echo "     (Anypoint, Salesforce, GitHub, Postman)"
echo "  2. Run: ./scripts/configure.sh"
echo "     (writes secrets to vault, sets up Maven"
echo "      settings.xml, authenticates SF CLI)"
echo "  3. Run: ./scripts/start.sh"
echo "     (starts Mule runtime + dashboard)"
echo "============================================"
