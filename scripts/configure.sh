#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Orca Community Edition Configuration"
echo "============================================"
echo ""

if [ ! -f "$ROOT_DIR/config.yaml" ]; then
  echo "config.yaml not found. Run ./scripts/setup.sh first."
  exit 1
fi

parse_yaml() {
  local file="$1" key="$2"
  python3 -c "
import yaml, sys
with open('$file') as f:
    d = yaml.safe_load(f)
keys = '$key'.split('.')
for k in keys:
    if isinstance(d, dict):
        d = d.get(k, '')
    else:
        d = ''
        break
print(d if d else '')
" 2>/dev/null || echo ""
}

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

BACKEND="$ROOT_DIR/backend"

write_secret() {
  local key="$1" value="$2" category="$3"
  if [ -n "$value" ]; then
    cd "$BACKEND" && bun -e "
      const { setSecret } = require('./src/services/vault');
      setSecret('$key', '$value', '$category');
      console.log('  [OK] $key');
    " 2>/dev/null || echo "  [SKIP] $key (write failed)"
  else
    echo "  [SKIP] $key (empty -- fill it in config.yaml)"
  fi
}

# --- 1. Read Anypoint credentials ---
AP_CLIENT_ID=$(parse_yaml "$ROOT_DIR/config.yaml" "anypoint.client_id")
AP_CLIENT_SECRET=$(parse_yaml "$ROOT_DIR/config.yaml" "anypoint.client_secret")
AP_ORG_ID=$(parse_yaml "$ROOT_DIR/config.yaml" "anypoint.org_id")

echo "Step 1/4: Writing Anypoint credentials to vault..."
echo ""
write_secret "anypoint_client_id" "$AP_CLIENT_ID" "anypoint"
write_secret "anypoint_client_secret" "$AP_CLIENT_SECRET" "anypoint"
write_secret "anypoint_org_id" "$AP_ORG_ID" "anypoint"
echo ""

# --- 2. Configure Maven settings.xml ---
echo "Step 2/4: Configuring Maven settings.xml..."
echo ""

SETTINGS_XML="$HOME/.m2/settings.xml"
mkdir -p "$HOME/.m2"

if [ -n "$AP_CLIENT_ID" ] && [ -n "$AP_CLIENT_SECRET" ]; then
  if [ -f "$SETTINGS_XML" ]; then
    if grep -q "anypoint-exchange-v3" "$SETTINGS_XML" 2>/dev/null; then
      echo "  [OK] ~/.m2/settings.xml already has Anypoint Exchange entry"
      echo "  Updating credentials in existing settings.xml..."

      cp "$SETTINGS_XML" "${SETTINGS_XML}.bak"

      python3 -c "
import re
with open('$SETTINGS_XML', 'r') as f:
    content = f.read()

pattern = r'(<server>\s*<id>anypoint-exchange-v3</id>\s*<username>~~~Client~~~</username>\s*<password>)[^<]*(</password>)'
replacement = r'\g<1>${AP_CLIENT_ID}~?~${AP_CLIENT_SECRET}\g<2>'
content = re.sub(pattern, replacement, content)

with open('$SETTINGS_XML', 'w') as f:
    f.write(content)
" 2>/dev/null

      if command -v sed &>/dev/null; then
        sed -i.tmp "s|${AP_CLIENT_ID}~?~${AP_CLIENT_SECRET}|${AP_CLIENT_ID}~?~${AP_CLIENT_SECRET}|g" "$SETTINGS_XML" 2>/dev/null
        rm -f "${SETTINGS_XML}.tmp"
      fi

      echo "  [OK] Credentials updated"
    else
      echo "  [INFO] settings.xml exists but missing Anypoint entry. Adding..."
      python3 -c "
import re
with open('$SETTINGS_XML', 'r') as f:
    content = f.read()

server_entry = '''
        <server>
            <id>anypoint-exchange-v3</id>
            <username>~~~Client~~~</username>
            <password>${AP_CLIENT_ID}~?~${AP_CLIENT_SECRET}</password>
        </server>'''

if '</servers>' in content:
    content = content.replace('</servers>', server_entry + '\n    </servers>')
elif '<servers>' in content:
    content = content.replace('<servers>', '<servers>' + server_entry)
elif '<settings' in content:
    content = content.replace('</settings>', '    <servers>' + server_entry + '\n    </servers>\n</settings>')

with open('$SETTINGS_XML', 'w') as f:
    f.write(content)
print('  [OK] Anypoint Exchange server entry added')
" 2>/dev/null || echo "  [SKIP] Could not auto-modify settings.xml"
    fi
  else
    echo "  [INFO] Creating new ~/.m2/settings.xml..."
    cat > "$SETTINGS_XML" << XMLEOF
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 http://maven.apache.org/xsd/settings-1.0.0.xsd">

    <servers>
        <server>
            <id>anypoint-exchange-v3</id>
            <username>~~~Client~~~</username>
            <password>${AP_CLIENT_ID}~?~${AP_CLIENT_SECRET}</password>
        </server>
    </servers>

    <profiles>
        <profile>
            <id>mulesoft</id>
            <repositories>
                <repository>
                    <id>anypoint-exchange-v3</id>
                    <name>Anypoint Exchange V3</name>
                    <url>https://maven.anypoint.mulesoft.com/api/v3/maven</url>
                    <layout>default</layout>
                </repository>
                <repository>
                    <id>mulesoft-releases</id>
                    <name>MuleSoft Releases</name>
                    <url>https://repository.mulesoft.org/releases/</url>
                    <layout>default</layout>
                </repository>
                <repository>
                    <id>mulesoft-public</id>
                    <name>MuleSoft Public</name>
                    <url>https://repository.mulesoft.org/nexus/content/repositories/public/</url>
                    <layout>default</layout>
                </repository>
            </repositories>
            <pluginRepositories>
                <pluginRepository>
                    <id>mulesoft-releases</id>
                    <name>MuleSoft Releases</name>
                    <url>https://repository.mulesoft.org/releases/</url>
                    <layout>default</layout>
                </pluginRepository>
                <pluginRepository>
                    <id>anypoint-exchange-v3</id>
                    <name>Anypoint Exchange V3</name>
                    <url>https://maven.anypoint.mulesoft.com/api/v3/maven</url>
                    <layout>default</layout>
                </pluginRepository>
            </pluginRepositories>
        </profile>
    </profiles>

    <activeProfiles>
        <activeProfile>mulesoft</activeProfile>
    </activeProfiles>
</settings>
XMLEOF
    echo "  [OK] ~/.m2/settings.xml created with Anypoint credentials and MuleSoft repos"
  fi
else
  echo "  [SKIP] Anypoint client_id or client_secret is empty in config.yaml"
  echo "  Maven settings.xml was not modified. Fill in Anypoint credentials and re-run."
fi
echo ""

# --- 3. Write remaining secrets to vault ---
echo "Step 3/4: Writing remaining credentials to vault..."
echo ""

SF_URL=$(parse_yaml "$ROOT_DIR/config.yaml" "salesforce.instance_url")
SF_USER=$(parse_yaml "$ROOT_DIR/config.yaml" "salesforce.username")
SF_PASS=$(parse_yaml "$ROOT_DIR/config.yaml" "salesforce.password")
SF_TOKEN=$(parse_yaml "$ROOT_DIR/config.yaml" "salesforce.security_token")

write_secret "salesforce_instance_url" "$SF_URL" "salesforce"
write_secret "salesforce_username" "$SF_USER" "salesforce"
write_secret "salesforce_password" "$SF_PASS" "salesforce"
write_secret "salesforce_security_token" "$SF_TOKEN" "salesforce"

GH_TOKEN=$(parse_yaml "$ROOT_DIR/config.yaml" "github.token")
GH_ORG=$(parse_yaml "$ROOT_DIR/config.yaml" "github.org")
write_secret "github_token" "$GH_TOKEN" "github"
write_secret "github_org" "$GH_ORG" "github"

PM_KEY=$(parse_yaml "$ROOT_DIR/config.yaml" "postman.api_key")
write_secret "postman_api_key" "$PM_KEY" "postman"
echo ""

# --- 4. Authenticate Salesforce CLI ---
echo "Step 4/4: Salesforce CLI authentication..."
echo ""

if [ -n "$SF_USER" ] && [ -n "$SF_PASS" ]; then
  SF_LOGIN_URL=$(parse_yaml "$ROOT_DIR/config.yaml" "salesforce.login_url")
  echo "  Authenticating as $SF_USER..."
  sf org login password \
    --instance-url "${SF_LOGIN_URL:-https://login.salesforce.com}" \
    --username "$SF_USER" \
    --password "${SF_PASS}${SF_TOKEN}" \
    --set-default 2>/dev/null && echo "  [OK] SF CLI authenticated" || echo "  [SKIP] SF CLI auth failed (check credentials in config.yaml)"
else
  echo "  [SKIP] Salesforce credentials not set in config.yaml"
fi

echo ""
echo "============================================"
echo "  Configuration complete!"
echo ""
echo "  What was configured:"
echo "    - Encrypted vault (backend/data/vault.enc)"
echo "    - Maven settings (~/.m2/settings.xml)"
echo "    - Salesforce CLI authentication"
echo ""
echo "  Next: ./scripts/start.sh"
echo "============================================"
