import fs from "fs";
import path from "path";
import type { Template, ScaffoldResult } from "./index";
import { generateSyncCollections } from "../services/postman";

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function pomXml(artifactId: string, deps: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.orcaesb</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>mule-application</packaging>
    <name>${artifactId}</name>
    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <mule.maven.plugin.version>4.3.0</mule.maven.plugin.version>
    </properties>
    <build>
        <plugins>
            <plugin>
                <groupId>org.mule.tools.maven</groupId>
                <artifactId>mule-maven-plugin</artifactId>
                <version>\${mule.maven.plugin.version}</version>
                <extensions>true</extensions>
                <configuration>
                    <classifier>mule-application</classifier>
                </configuration>
            </plugin>
        </plugins>
    </build>
    <dependencies>
        <dependency>
            <groupId>org.mule.connectors</groupId>
            <artifactId>mule-http-connector</artifactId>
            <version>1.10.4</version>
            <classifier>mule-plugin</classifier>
        </dependency>
${deps}
    </dependencies>
    <repositories>
        <repository>
            <id>anypoint-exchange-v3</id>
            <name>Anypoint Exchange</name>
            <url>https://maven.anypoint.mulesoft.com/api/v3/maven</url>
        </repository>
        <repository>
            <id>mulesoft-releases</id>
            <name>MuleSoft Releases</name>
            <url>https://repository.mulesoft.org/releases/</url>
        </repository>
    </repositories>
    <pluginRepositories>
        <pluginRepository>
            <id>mulesoft-releases</id>
            <name>MuleSoft Releases</name>
            <url>https://repository.mulesoft.org/releases/</url>
        </pluginRepository>
    </pluginRepositories>
</project>
`;
}

const muleArtifactJson = JSON.stringify(
  { minMuleVersion: "4.11.0", classLoaderModelLoaderDescriptor: { id: "mule" } },
  null,
  2
);

const gitignore = `target/
.mule/
*.jar
*.class
.DS_Store
__pycache__/
.pytest_cache/
`;

// ─── sf-system-api ────────────────────────────────────────────────────────────

function scaffoldSfSystemApi(basePath: string, prefix: string): string[] {
  const name = `${prefix}-sf-system-api`;
  const p = path.join(basePath, name);
  const files: string[] = [];

  // RAML
  write(
    path.join(p, "src/main/resources/api/sf-system-api.raml"),
    `#%RAML 1.0
title: Salesforce System API
version: v1
baseUri: http://localhost:8082/api

types:
  Contact:
    properties:
      Id?: string
      FirstName: string
      LastName: string
      Email: string
      Phone?: string
      AccountId?: string
  Account:
    properties:
      Id?: string
      Name: string
      Industry?: string
      Phone?: string
      Website?: string

/contacts:
  get:
    description: List all Salesforce contacts
    queryParameters:
      lastModified:
        type: string
        required: false
        description: ISO datetime — return only contacts modified after this time
    responses:
      200:
        body:
          application/json:
            type: Contact[]
  post:
    description: Create or update a contact (upsert by Email)
    body:
      application/json:
        type: Contact
    responses:
      200:
        body:
          application/json:
            example: |
              {"id": "003xx000004TmiQAAS", "success": true}

  /{id}:
    get:
      responses:
        200:
          body:
            application/json:
              type: Contact

/accounts:
  get:
    description: List all Salesforce accounts
    queryParameters:
      lastModified:
        type: string
        required: false
    responses:
      200:
        body:
          application/json:
            type: Account[]
  post:
    description: Create or update an account (upsert by Name)
    body:
      application/json:
        type: Account
    responses:
      200:
        body:
          application/json:
            example: |
              {"id": "001xx000003GYmPAAW", "success": true}

  /{id}:
    get:
      responses:
        200:
          body:
            application/json:
              type: Account
`
  );
  files.push(`${name}/src/main/resources/api/sf-system-api.raml`);

  // Mule XML
  write(
    path.join(p, "src/main/mule/sf-system-api.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:salesforce="http://www.mulesoft.org/schema/mule/salesforce"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd
        http://www.mulesoft.org/schema/mule/salesforce http://www.mulesoft.org/schema/mule/salesforce/current/mule-salesforce.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <configuration-properties file="config.properties" />

    <http:listener-config name="HTTP_Listener_config">
        <http:listener-connection host="0.0.0.0" port="\${http.port}" />
    </http:listener-config>

    <salesforce:sfdc-config name="Salesforce_Config">
        <salesforce:basic-connection
            username="\${sf.username}"
            password="\${sf.password}"
            securityToken="\${sf.securityToken}"
            url="\${sf.loginUrl}" />
    </salesforce:sfdc-config>

    <!-- GET /api/contacts -->
    <flow name="get-contacts-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/contacts" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, FirstName, LastName, Email, Phone, AccountId, LastModifiedDate
                FROM Contact
                ORDER BY LastModifiedDate DESC
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload map {
    Id: $.Id,
    FirstName: $.FirstName,
    LastName: $.LastName,
    Email: $.Email,
    Phone: $.Phone,
    AccountId: $.AccountId,
    LastModifiedDate: $.LastModifiedDate
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- POST /api/contacts (upsert) -->
    <flow name="upsert-contact-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/contacts" method="POST" />
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/java
---
[{
    FirstName: payload.FirstName,
    LastName: payload.LastName,
    Email: payload.Email,
    Phone: payload.Phone,
    AccountId: payload.AccountId
}]]]></ee:set-payload>
            </ee:message>
        </ee:transform>
        <salesforce:upsert config-ref="Salesforce_Config" objectType="Contact" externalIdFieldName="Email" />
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
    id: payload[0].id default "",
    success: payload[0].success default false
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/contacts/{id} -->
    <flow name="get-contact-by-id-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/contacts/{id}" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, FirstName, LastName, Email, Phone, AccountId
                FROM Contact
                WHERE Id = ':id'
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload[0]]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/accounts -->
    <flow name="get-accounts-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/accounts" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, Name, Industry, Phone, Website, LastModifiedDate
                FROM Account
                ORDER BY LastModifiedDate DESC
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload map {
    Id: $.Id,
    Name: $.Name,
    Industry: $.Industry,
    Phone: $.Phone,
    Website: $.Website,
    LastModifiedDate: $.LastModifiedDate
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- POST /api/accounts (upsert) -->
    <flow name="upsert-account-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/accounts" method="POST" />
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/java
---
[{
    Name: payload.Name,
    Industry: payload.Industry,
    Phone: payload.Phone,
    Website: payload.Website
}]]]></ee:set-payload>
            </ee:message>
        </ee:transform>
        <salesforce:upsert config-ref="Salesforce_Config" objectType="Account" externalIdFieldName="Name" />
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
    id: payload[0].id default "",
    success: payload[0].success default false
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/accounts/{id} -->
    <flow name="get-account-by-id-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/accounts/{id}" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, Name, Industry, Phone, Website
                FROM Account
                WHERE Id = ':id'
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload[0]]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/sf-system-api.xml`);

  // config.properties
  write(
    path.join(p, "src/main/resources/config.properties"),
    `http.port=8082
sf.username=\${SF_USERNAME}
sf.password=\${SF_PASSWORD}
sf.securityToken=\${SF_SECURITY_TOKEN}
sf.loginUrl=https://login.salesforce.com
`
  );
  files.push(`${name}/src/main/resources/config.properties`);

  // pom.xml
  const sfDeps = `        <dependency>
            <groupId>com.mulesoft.connectors</groupId>
            <artifactId>mule-salesforce-connector</artifactId>
            <version>10.20.0</version>
            <classifier>mule-plugin</classifier>
        </dependency>
        <dependency>
            <groupId>org.mule.modules</groupId>
            <artifactId>mule-apikit-module</artifactId>
            <version>1.10.4</version>
            <classifier>mule-plugin</classifier>
        </dependency>`;
  write(path.join(p, "pom.xml"), pomXml(name, sfDeps));
  files.push(`${name}/pom.xml`);

  write(path.join(p, "mule-artifact.json"), muleArtifactJson);
  write(path.join(p, "src/main/resources/mule-artifact.json"), muleArtifactJson);
  write(path.join(p, ".gitignore"), gitignore);
  write(
    path.join(p, "README.md"),
    `# ${name}\n\nSalesforce System API — CRUD operations for Contacts and Accounts via the MuleSoft Salesforce Connector.\n\nPart of the SF-Postgres Bidirectional Sync use case scaffolded by Orca.\n\n## Endpoints\n\n- \`GET /api/contacts\` — list contacts\n- \`POST /api/contacts\` — upsert contact\n- \`GET /api/contacts/{id}\` — get contact by ID\n- \`GET /api/accounts\` — list accounts\n- \`POST /api/accounts\` — upsert account\n- \`GET /api/accounts/{id}\` — get account by ID\n\n## Port: 8082\n`
  );
  files.push(`${name}/README.md`);

  // Tests
  write(
    path.join(p, "tests/test_sf_system_api.py"),
    `import requests
import pytest

BASE_URL = "http://localhost:8082"

class TestSfContacts:
    def test_get_contacts_200(self):
        resp = requests.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200

    def test_get_contacts_returns_list(self):
        resp = requests.get(f"{BASE_URL}/api/contacts")
        data = resp.json()
        assert isinstance(data, list)

    def test_upsert_contact(self):
        payload = {"FirstName": "Test", "LastName": "Orca", "Email": "test@orca.dev"}
        resp = requests.post(f"{BASE_URL}/api/contacts", json=payload)
        assert resp.status_code == 200
        assert resp.json().get("success") is True

class TestSfAccounts:
    def test_get_accounts_200(self):
        resp = requests.get(f"{BASE_URL}/api/accounts")
        assert resp.status_code == 200

    def test_upsert_account(self):
        payload = {"Name": "Orca Test Corp", "Industry": "Technology"}
        resp = requests.post(f"{BASE_URL}/api/accounts", json=payload)
        assert resp.status_code == 200
        assert resp.json().get("success") is True
`
  );
  files.push(`${name}/tests/test_sf_system_api.py`);

  return files;
}

// ─── db-system-api ────────────────────────────────────────────────────────────

function scaffoldDbSystemApi(basePath: string, prefix: string): string[] {
  const name = `${prefix}-db-system-api`;
  const p = path.join(basePath, name);
  const files: string[] = [];

  // RAML
  write(
    path.join(p, "src/main/resources/api/db-system-api.raml"),
    `#%RAML 1.0
title: Database System API
version: v1
baseUri: http://localhost:8083/api

types:
  Contact:
    properties:
      id?: integer
      sf_id?: string
      first_name: string
      last_name: string
      email: string
      phone?: string
      account_id?: string
      last_modified?: string
      sync_status?: string
  Account:
    properties:
      id?: integer
      sf_id?: string
      name: string
      industry?: string
      phone?: string
      website?: string
      last_modified?: string
      sync_status?: string

/contacts:
  get:
    description: List all contacts from PostgreSQL
    queryParameters:
      since:
        type: string
        required: false
        description: ISO datetime — return rows modified after this time
    responses:
      200:
        body:
          application/json:
            type: Contact[]
  post:
    description: Upsert a contact (by sf_id or email)
    body:
      application/json:
        type: Contact
    responses:
      200:
        body:
          application/json:
            example: |
              {"id": 1, "action": "upserted"}

/accounts:
  get:
    description: List all accounts from PostgreSQL
    queryParameters:
      since:
        type: string
        required: false
    responses:
      200:
        body:
          application/json:
            type: Account[]
  post:
    description: Upsert an account (by sf_id or name)
    body:
      application/json:
        type: Account
    responses:
      200:
        body:
          application/json:
            example: |
              {"id": 1, "action": "upserted"}

/health:
  get:
    responses:
      200:
        body:
          application/json:
            example: |
              {"status": "UP", "database": "connected"}
`
  );
  files.push(`${name}/src/main/resources/api/db-system-api.raml`);

  // SQL migration
  write(
    path.join(p, "src/main/resources/sql/001_create_tables.sql"),
    `-- Contacts table synced with Salesforce
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    sf_id VARCHAR(18) UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    account_id VARCHAR(18),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_sf_id ON contacts(sf_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_last_modified ON contacts(last_modified);
CREATE INDEX IF NOT EXISTS idx_contacts_sync_status ON contacts(sync_status);

-- Accounts table synced with Salesforce
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    sf_id VARCHAR(18) UNIQUE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_sf_id ON accounts(sf_id);
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
CREATE INDEX IF NOT EXISTS idx_accounts_last_modified ON accounts(last_modified);
CREATE INDEX IF NOT EXISTS idx_accounts_sync_status ON accounts(sync_status);

-- Trigger function to auto-update last_modified and mark pending sync
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = NOW();
    IF NEW.sync_status = 'synced' THEN
        NEW.sync_status = 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_contacts_modified
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_last_modified();

CREATE OR REPLACE TRIGGER trg_accounts_modified
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_last_modified();
`
  );
  files.push(`${name}/src/main/resources/sql/001_create_tables.sql`);

  // Mule XML
  write(
    path.join(p, "src/main/mule/db-system-api.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:db="http://www.mulesoft.org/schema/mule/db"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd
        http://www.mulesoft.org/schema/mule/db http://www.mulesoft.org/schema/mule/db/current/mule-db.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <configuration-properties file="config.properties" />

    <http:listener-config name="HTTP_Listener_config">
        <http:listener-connection host="0.0.0.0" port="\${http.port}" />
    </http:listener-config>

    <db:config name="Database_Config">
        <db:generic-connection url="\${db.url}" driverClassName="org.postgresql.Driver" />
    </db:config>

    <!-- GET /api/health -->
    <flow name="health-check-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/health" method="GET" />
        <db:select config-ref="Database_Config">
            <db:sql>SELECT 1 as connected</db:sql>
        </db:select>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ status: "UP", database: "connected" }]]></ee:set-payload>
            </ee:message>
        </ee:transform>
        <error-handler>
            <on-error-continue>
                <ee:transform>
                    <ee:message>
                        <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ status: "DOWN", database: "disconnected" }]]></ee:set-payload>
                    </ee:message>
                </ee:transform>
            </on-error-continue>
        </error-handler>
    </flow>

    <!-- GET /api/contacts -->
    <flow name="get-contacts-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/contacts" method="GET" />
        <db:select config-ref="Database_Config">
            <db:sql>SELECT id, sf_id, first_name, last_name, email, phone, account_id, last_modified, sync_status FROM contacts ORDER BY last_modified DESC</db:sql>
        </db:select>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- POST /api/contacts (upsert) -->
    <flow name="upsert-contact-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/contacts" method="POST" />
        <db:insert config-ref="Database_Config">
            <db:sql>
                INSERT INTO contacts (sf_id, first_name, last_name, email, phone, account_id, sync_status)
                VALUES (:sfId, :firstName, :lastName, :email, :phone, :accountId, :syncStatus)
                ON CONFLICT (sf_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    account_id = EXCLUDED.account_id,
                    sync_status = EXCLUDED.sync_status,
                    last_modified = NOW()
            </db:sql>
            <db:input-parameters><![CDATA[#[{
                sfId: payload.sf_id default "",
                firstName: payload.first_name,
                lastName: payload.last_name,
                email: payload.email,
                phone: payload.phone default "",
                accountId: payload.account_id default "",
                syncStatus: payload.sync_status default "synced"
            }]]]></db:input-parameters>
        </db:insert>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ id: payload.generatedKeys.id default 0, action: "upserted" }]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/accounts -->
    <flow name="get-accounts-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/accounts" method="GET" />
        <db:select config-ref="Database_Config">
            <db:sql>SELECT id, sf_id, name, industry, phone, website, last_modified, sync_status FROM accounts ORDER BY last_modified DESC</db:sql>
        </db:select>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- POST /api/accounts (upsert) -->
    <flow name="upsert-account-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/accounts" method="POST" />
        <db:insert config-ref="Database_Config">
            <db:sql>
                INSERT INTO accounts (sf_id, name, industry, phone, website, sync_status)
                VALUES (:sfId, :name, :industry, :phone, :website, :syncStatus)
                ON CONFLICT (sf_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    industry = EXCLUDED.industry,
                    phone = EXCLUDED.phone,
                    website = EXCLUDED.website,
                    sync_status = EXCLUDED.sync_status,
                    last_modified = NOW()
            </db:sql>
            <db:input-parameters><![CDATA[#[{
                sfId: payload.sf_id default "",
                name: payload.name,
                industry: payload.industry default "",
                phone: payload.phone default "",
                website: payload.website default "",
                syncStatus: payload.sync_status default "synced"
            }]]]></db:input-parameters>
        </db:insert>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ id: payload.generatedKeys.id default 0, action: "upserted" }]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/db-system-api.xml`);

  // config.properties
  write(
    path.join(p, "src/main/resources/config.properties"),
    `http.port=8083
db.url=\${NEON_DATABASE_URL}
`
  );
  files.push(`${name}/src/main/resources/config.properties`);

  // pom.xml
  const dbDeps = `        <dependency>
            <groupId>org.mule.connectors</groupId>
            <artifactId>mule-db-connector</artifactId>
            <version>1.14.6</version>
            <classifier>mule-plugin</classifier>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <version>42.7.4</version>
        </dependency>
        <dependency>
            <groupId>org.mule.modules</groupId>
            <artifactId>mule-apikit-module</artifactId>
            <version>1.10.4</version>
            <classifier>mule-plugin</classifier>
        </dependency>`;
  write(path.join(p, "pom.xml"), pomXml(name, dbDeps));
  files.push(`${name}/pom.xml`);

  write(path.join(p, "mule-artifact.json"), muleArtifactJson);
  write(path.join(p, "src/main/resources/mule-artifact.json"), muleArtifactJson);
  write(path.join(p, ".gitignore"), gitignore);
  write(
    path.join(p, "README.md"),
    `# ${name}\n\nDatabase System API — CRUD operations for Contacts and Accounts against Neon PostgreSQL.\n\nPart of the SF-Postgres Bidirectional Sync use case scaffolded by Orca.\n\n## Endpoints\n\n- \`GET /api/contacts\` — list contacts (with optional \`?since=\` filter)\n- \`POST /api/contacts\` — upsert contact\n- \`GET /api/accounts\` — list accounts\n- \`POST /api/accounts\` — upsert account\n- \`GET /api/health\` — database connectivity check\n\n## Port: 8083\n\n## Database Setup\n\nRun the SQL migration in \`src/main/resources/sql/001_create_tables.sql\` against your Neon database.\n`
  );
  files.push(`${name}/README.md`);

  // Tests
  write(
    path.join(p, "tests/test_db_system_api.py"),
    `import requests
import pytest

BASE_URL = "http://localhost:8083"

class TestDbHealth:
    def test_health_200(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        assert resp.json().get("status") == "UP"

class TestDbContacts:
    def test_get_contacts_200(self):
        resp = requests.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200

    def test_upsert_contact(self):
        payload = {"sf_id": "003TEST001", "first_name": "Test", "last_name": "Orca", "email": "test@orca.dev"}
        resp = requests.post(f"{BASE_URL}/api/contacts", json=payload)
        assert resp.status_code == 200
        assert resp.json().get("action") == "upserted"

class TestDbAccounts:
    def test_get_accounts_200(self):
        resp = requests.get(f"{BASE_URL}/api/accounts")
        assert resp.status_code == 200

    def test_upsert_account(self):
        payload = {"sf_id": "001TEST001", "name": "Orca Test Corp", "industry": "Technology"}
        resp = requests.post(f"{BASE_URL}/api/accounts", json=payload)
        assert resp.status_code == 200
        assert resp.json().get("action") == "upserted"
`
  );
  files.push(`${name}/tests/test_db_system_api.py`);

  return files;
}

// ─── sync-process-api ─────────────────────────────────────────────────────────

function scaffoldSyncProcessApi(basePath: string, prefix: string): string[] {
  const name = `${prefix}-sync-process-api`;
  const p = path.join(basePath, name);
  const files: string[] = [];

  // DataWeave mappings
  write(
    path.join(p, "src/main/resources/dwl/sf-contact-to-db.dwl"),
    `%dw 2.0
output application/json
---
{
    sf_id: payload.Id,
    first_name: payload.FirstName default "",
    last_name: payload.LastName default "",
    email: payload.Email default "",
    phone: payload.Phone default "",
    account_id: payload.AccountId default "",
    sync_status: "synced"
}
`
  );
  files.push(`${name}/src/main/resources/dwl/sf-contact-to-db.dwl`);

  write(
    path.join(p, "src/main/resources/dwl/sf-account-to-db.dwl"),
    `%dw 2.0
output application/json
---
{
    sf_id: payload.Id,
    name: payload.Name default "",
    industry: payload.Industry default "",
    phone: payload.Phone default "",
    website: payload.Website default "",
    sync_status: "synced"
}
`
  );
  files.push(`${name}/src/main/resources/dwl/sf-account-to-db.dwl`);

  write(
    path.join(p, "src/main/resources/dwl/db-contact-to-sf.dwl"),
    `%dw 2.0
output application/json
---
{
    Id: payload.sf_id,
    FirstName: payload.first_name,
    LastName: payload.last_name,
    Email: payload.email,
    Phone: payload.phone default "",
    AccountId: payload.account_id default ""
}
`
  );
  files.push(`${name}/src/main/resources/dwl/db-contact-to-sf.dwl`);

  write(
    path.join(p, "src/main/resources/dwl/db-account-to-sf.dwl"),
    `%dw 2.0
output application/json
---
{
    Id: payload.sf_id,
    Name: payload.name,
    Industry: payload.industry default "",
    Phone: payload.phone default "",
    Website: payload.website default ""
}
`
  );
  files.push(`${name}/src/main/resources/dwl/db-account-to-sf.dwl`);

  // Mule XML — SF to Postgres (CDC listener)
  write(
    path.join(p, "src/main/mule/sf-to-postgres-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:salesforce="http://www.mulesoft.org/schema/mule/salesforce"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd
        http://www.mulesoft.org/schema/mule/salesforce http://www.mulesoft.org/schema/mule/salesforce/current/mule-salesforce.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <configuration-properties file="config.properties" />

    <salesforce:sfdc-config name="Salesforce_CDC_Config">
        <salesforce:basic-connection
            username="\${sf.username}"
            password="\${sf.password}"
            securityToken="\${sf.securityToken}"
            url="\${sf.loginUrl}" />
    </salesforce:sfdc-config>

    <http:request-config name="DB_System_API">
        <http:request-connection host="localhost" port="\${db.system.api.port}" />
    </http:request-config>

    <!-- CDC Listener for Contact changes -->
    <flow name="sf-contact-cdc-flow">
        <salesforce:subscribe-channel-listener config-ref="Salesforce_CDC_Config"
            streamingType="CDC"
            channel="/data/ContactChangeEvent" />
        <logger level="INFO" message="CDC Contact event received: #[payload]" />
        <foreach>
            <ee:transform>
                <ee:message>
                    <ee:set-payload resource="dwl/sf-contact-to-db.dwl" />
                </ee:message>
            </ee:transform>
            <http:request config-ref="DB_System_API" method="POST" path="/api/contacts">
                <http:body><![CDATA[#[payload]]]></http:body>
                <http:headers><![CDATA[#[{"Content-Type": "application/json"}]]]></http:headers>
            </http:request>
        </foreach>
        <logger level="INFO" message="CDC Contact sync complete" />
    </flow>

    <!-- CDC Listener for Account changes -->
    <flow name="sf-account-cdc-flow">
        <salesforce:subscribe-channel-listener config-ref="Salesforce_CDC_Config"
            streamingType="CDC"
            channel="/data/AccountChangeEvent" />
        <logger level="INFO" message="CDC Account event received: #[payload]" />
        <foreach>
            <ee:transform>
                <ee:message>
                    <ee:set-payload resource="dwl/sf-account-to-db.dwl" />
                </ee:message>
            </ee:transform>
            <http:request config-ref="DB_System_API" method="POST" path="/api/accounts">
                <http:body><![CDATA[#[payload]]]></http:body>
                <http:headers><![CDATA[#[{"Content-Type": "application/json"}]]]></http:headers>
            </http:request>
        </foreach>
        <logger level="INFO" message="CDC Account sync complete" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/sf-to-postgres-flow.xml`);

  // Mule XML — Postgres to SF (scheduler poll)
  write(
    path.join(p, "src/main/mule/postgres-to-sf-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:os="http://www.mulesoft.org/schema/mule/os"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd
        http://www.mulesoft.org/schema/mule/os http://www.mulesoft.org/schema/mule/os/current/mule-os.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <configuration-properties file="config.properties" />

    <http:request-config name="DB_System_API_Poll">
        <http:request-connection host="localhost" port="\${db.system.api.port}" />
    </http:request-config>

    <http:request-config name="SF_System_API">
        <http:request-connection host="localhost" port="\${sf.system.api.port}" />
    </http:request-config>

    <os:object-store name="PollStateStore" persistent="true" />

    <!-- Poll contacts every 15 seconds -->
    <flow name="poll-db-contacts-flow">
        <scheduler>
            <scheduling-strategy>
                <fixed-frequency frequency="\${poll.frequency.seconds}" timeUnit="SECONDS" />
            </scheduling-strategy>
        </scheduler>
        <logger level="DEBUG" message="Polling DB for pending contacts..." />
        <http:request config-ref="DB_System_API_Poll" method="GET" path="/api/contacts">
            <http:query-params><![CDATA[#[{"since": vars.lastPollTime default "1970-01-01T00:00:00Z"}]]]></http:query-params>
        </http:request>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/java
---
(payload filter ($.sync_status == "pending")) default []]]></ee:set-payload>
            </ee:message>
        </ee:transform>
        <foreach>
            <ee:transform>
                <ee:message>
                    <ee:set-payload resource="dwl/db-contact-to-sf.dwl" />
                </ee:message>
            </ee:transform>
            <http:request config-ref="SF_System_API" method="POST" path="/api/contacts">
                <http:body><![CDATA[#[payload]]]></http:body>
                <http:headers><![CDATA[#[{"Content-Type": "application/json"}]]]></http:headers>
            </http:request>
        </foreach>
        <logger level="DEBUG" message="Contact poll sync complete" />
    </flow>

    <!-- Poll accounts every 15 seconds -->
    <flow name="poll-db-accounts-flow">
        <scheduler>
            <scheduling-strategy>
                <fixed-frequency frequency="\${poll.frequency.seconds}" timeUnit="SECONDS" />
            </scheduling-strategy>
        </scheduler>
        <logger level="DEBUG" message="Polling DB for pending accounts..." />
        <http:request config-ref="DB_System_API_Poll" method="GET" path="/api/accounts">
            <http:query-params><![CDATA[#[{"since": vars.lastPollTime default "1970-01-01T00:00:00Z"}]]]></http:query-params>
        </http:request>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/java
---
(payload filter ($.sync_status == "pending")) default []]]></ee:set-payload>
            </ee:message>
        </ee:transform>
        <foreach>
            <ee:transform>
                <ee:message>
                    <ee:set-payload resource="dwl/db-account-to-sf.dwl" />
                </ee:message>
            </ee:transform>
            <http:request config-ref="SF_System_API" method="POST" path="/api/accounts">
                <http:body><![CDATA[#[payload]]]></http:body>
                <http:headers><![CDATA[#[{"Content-Type": "application/json"}]]]></http:headers>
            </http:request>
        </foreach>
        <logger level="DEBUG" message="Account poll sync complete" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/postgres-to-sf-flow.xml`);

  // Global config
  write(
    path.join(p, "src/main/mule/global-config.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd">

    <configuration-properties file="config.properties" />

    <http:listener-config name="HTTP_Listener_config">
        <http:listener-connection host="0.0.0.0" port="\${http.port}" />
    </http:listener-config>

    <!-- Health check endpoint -->
    <flow name="sync-health-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/health" method="GET" />
        <ee:transform xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
    status: "UP",
    service: "sync-process-api",
    sfSystemApi: "\${sf.system.api.port}",
    dbSystemApi: "\${db.system.api.port}",
    pollFrequency: "\${poll.frequency.seconds}s"
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/global-config.xml`);

  // config.properties
  write(
    path.join(p, "src/main/resources/config.properties"),
    `http.port=8081
sf.username=\${SF_USERNAME}
sf.password=\${SF_PASSWORD}
sf.securityToken=\${SF_SECURITY_TOKEN}
sf.loginUrl=https://login.salesforce.com
sf.system.api.port=8082
db.system.api.port=8083
poll.frequency.seconds=15
`
  );
  files.push(`${name}/src/main/resources/config.properties`);

  // RAML (simple health-only for the process API itself)
  write(
    path.join(p, "src/main/resources/api/sync-process-api.raml"),
    `#%RAML 1.0
title: Sync Process API
version: v1
baseUri: http://localhost:8081/api
description: |
  Orchestrates bidirectional sync between Salesforce and PostgreSQL.
  - SF -> Postgres: Real-time via Salesforce CDC events
  - Postgres -> SF: Polling every 15 seconds for pending changes

/health:
  get:
    description: Returns sync process health and configuration
    responses:
      200:
        body:
          application/json:
            example: |
              {
                "status": "UP",
                "service": "sync-process-api",
                "sfSystemApi": "8082",
                "dbSystemApi": "8083",
                "pollFrequency": "15s"
              }
`
  );
  files.push(`${name}/src/main/resources/api/sync-process-api.raml`);

  // pom.xml
  const syncDeps = `        <dependency>
            <groupId>com.mulesoft.connectors</groupId>
            <artifactId>mule-salesforce-connector</artifactId>
            <version>10.20.0</version>
            <classifier>mule-plugin</classifier>
        </dependency>
        <dependency>
            <groupId>org.mule.connectors</groupId>
            <artifactId>mule-objectstore-connector</artifactId>
            <version>1.2.2</version>
            <classifier>mule-plugin</classifier>
        </dependency>
        <dependency>
            <groupId>org.mule.modules</groupId>
            <artifactId>mule-apikit-module</artifactId>
            <version>1.10.4</version>
            <classifier>mule-plugin</classifier>
        </dependency>`;
  write(path.join(p, "pom.xml"), pomXml(name, syncDeps));
  files.push(`${name}/pom.xml`);

  write(path.join(p, "mule-artifact.json"), muleArtifactJson);
  write(path.join(p, "src/main/resources/mule-artifact.json"), muleArtifactJson);
  write(path.join(p, ".gitignore"), gitignore);
  write(
    path.join(p, "README.md"),
    `# ${name}\n\nSync Process API — Orchestrates bidirectional sync between Salesforce and Neon PostgreSQL.\n\nPart of the SF-Postgres Bidirectional Sync use case scaffolded by Orca.\n\n## Architecture\n\n- **SF -> Postgres**: Salesforce CDC (Change Data Capture) events trigger real-time sync\n- **Postgres -> SF**: Scheduler polls every 15s for rows with \`sync_status='pending'\`\n\n## Dependencies\n\n- sf-system-api (port 8082)\n- db-system-api (port 8083)\n\n## Port: 8081\n`
  );
  files.push(`${name}/README.md`);

  // Tests
  write(
    path.join(p, "tests/test_sync_process_api.py"),
    `import requests
import pytest

SYNC_URL = "http://localhost:8081"
SF_URL = "http://localhost:8082"
DB_URL = "http://localhost:8083"

class TestSyncHealth:
    def test_sync_health_200(self):
        resp = requests.get(f"{SYNC_URL}/api/health")
        assert resp.status_code == 200
        assert resp.json().get("status") == "UP"

class TestEndToEndSync:
    """Integration tests — requires all three APIs running"""

    def test_sf_api_reachable(self):
        resp = requests.get(f"{SF_URL}/api/contacts")
        assert resp.status_code == 200

    def test_db_api_reachable(self):
        resp = requests.get(f"{DB_URL}/api/contacts")
        assert resp.status_code == 200

    def test_db_health(self):
        resp = requests.get(f"{DB_URL}/api/health")
        assert resp.status_code == 200
`
  );
  files.push(`${name}/tests/test_sync_process_api.py`);

  return files;
}

// ─── Main template ────────────────────────────────────────────────────────────

export const sfPostgresSyncTemplate: Template = {
  metadata: {
    id: "sf-postgres-sync",
    name: "Salesforce-Postgres Bidirectional Sync",
    description:
      "Three MuleSoft APIs implementing real-time bidirectional sync between Salesforce Contacts/Accounts and Neon PostgreSQL. Uses CDC for SF-to-Postgres and polling for Postgres-to-SF with a 30-second SLA.",
    requiredCredentials: ["anypoint", "salesforce", "neon"],
    ports: {
      "sync-process-api": 8081,
      "sf-system-api": 8082,
      "db-system-api": 8083,
    },
    projects: ["${projectName}-sync-process-api", "${projectName}-sf-system-api", "${projectName}-db-system-api"],
    architecture: "CDC + Polling",
  },

  async scaffold(basePath: string, projectName: string): Promise<ScaffoldResult> {
    const allFiles: string[] = [];

    allFiles.push(...scaffoldSfSystemApi(basePath, projectName));
    allFiles.push(...scaffoldDbSystemApi(basePath, projectName));
    allFiles.push(...scaffoldSyncProcessApi(basePath, projectName));

    const postmanDir = path.join(basePath, `${projectName}-sync-process-api`, "postman");
    const postmanFiles = generateSyncCollections(projectName, postmanDir);
    for (const pf of postmanFiles) {
      allFiles.push(`${projectName}-sync-process-api/postman/${pf}`);
    }

    return {
      files: allFiles,
      projects: [
        `${projectName}-sync-process-api`,
        `${projectName}-sf-system-api`,
        `${projectName}-db-system-api`,
      ],
    };
  },
};
