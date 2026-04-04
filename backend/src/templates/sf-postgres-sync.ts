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

const kafkaConnectorDep = `        <dependency>
            <groupId>com.mulesoft.connectors</groupId>
            <artifactId>mule-kafka-connector</artifactId>
            <version>4.12.2</version>
            <classifier>mule-plugin</classifier>
        </dependency>`;

const cryptoModuleDep = `        <dependency>
            <groupId>com.mulesoft.modules</groupId>
            <artifactId>mule-cryptography-module</artifactId>
            <version>1.7.3</version>
            <classifier>mule-plugin</classifier>
        </dependency>`;

// ─── Canonical Data Model ─────────────────────────────────────────────────────

function scaffoldCanonicalModel(basePath: string, prefix: string): string[] {
  const commonDir = path.join(basePath, `${prefix}-common`);
  const files: string[] = [];

  // RAML Types
  write(
    path.join(commonDir, "raml/types/Contact.raml"),
    `#%RAML 1.0 DataType
displayName: Canonical Contact
description: Shared contact representation used across all APIs and Kafka topics
properties:
  sf_id:
    type: string
    required: false
    description: Salesforce record ID (18-char)
    (x-sensitivity): internal
  first_name:
    type: string
    (x-sensitivity): pii
  last_name:
    type: string
    (x-sensitivity): pii
  email:
    type: string
    (x-sensitivity): pii
  phone:
    type: string
    required: false
    (x-sensitivity): pii
  account_id:
    type: string
    required: false
    description: Salesforce Account ID reference
    (x-sensitivity): internal
  correlation_id:
    type: string
    required: false
    description: UUID for end-to-end tracing
    (x-sensitivity): internal
  sync_status:
    type: string
    required: false
    enum: [synced, pending, error]
    default: synced
  last_modified:
    type: datetime
    required: false
`
  );
  files.push(`${prefix}-common/raml/types/Contact.raml`);

  write(
    path.join(commonDir, "raml/types/Account.raml"),
    `#%RAML 1.0 DataType
displayName: Canonical Account
description: Shared account representation used across all APIs and Kafka topics
properties:
  sf_id:
    type: string
    required: false
    (x-sensitivity): internal
  name:
    type: string
  industry:
    type: string
    required: false
  phone:
    type: string
    required: false
    (x-sensitivity): pii
  website:
    type: string
    required: false
  correlation_id:
    type: string
    required: false
    (x-sensitivity): internal
  sync_status:
    type: string
    required: false
    enum: [synced, pending, error]
    default: synced
  last_modified:
    type: datetime
    required: false
`
  );
  files.push(`${prefix}-common/raml/types/Account.raml`);

  write(
    path.join(commonDir, "raml/types/SyncEvent.raml"),
    `#%RAML 1.0 DataType
displayName: Sync Event (Audit)
description: Audit event published to orca.audit.sync-events Kafka topic
properties:
  correlation_id:
    type: string
    description: UUID propagated end-to-end
  timestamp:
    type: datetime
  source:
    type: string
    enum: [sfdc, neon]
  target:
    type: string
    enum: [neon, sfdc]
  object_type:
    type: string
    enum: [contact, account]
  object_id:
    type: string
    description: SF ID or DB ID
  action:
    type: string
    enum: [create, update, delete]
  status:
    type: string
    enum: [success, failure]
  duration_ms:
    type: integer
    required: false
  error_message:
    type: string
    required: false
`
  );
  files.push(`${prefix}-common/raml/types/SyncEvent.raml`);

  write(
    path.join(commonDir, "raml/types/ErrorEvent.raml"),
    `#%RAML 1.0 DataType
displayName: Error Event (DLQ)
description: Dead-letter queue event published to orca.dlq.sync-failures
properties:
  correlation_id:
    type: string
  timestamp:
    type: datetime
  source_topic:
    type: string
  source_app:
    type: string
  object_type:
    type: string
    enum: [contact, account]
  object_id:
    type: string
    required: false
  error_type:
    type: string
  error_message:
    type: string
  original_payload:
    type: string
    description: JSON-stringified original message
    (x-sensitivity): secret
`
  );
  files.push(`${prefix}-common/raml/types/ErrorEvent.raml`);

  // JSON Schemas for Kafka
  write(
    path.join(commonDir, "json-schema/contact.schema.json"),
    JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "orca.canonical.contact",
      title: "Canonical Contact",
      type: "object",
      required: ["first_name", "last_name", "email"],
      properties: {
        sf_id: { type: "string", maxLength: 18, "x-sensitivity": "internal" },
        first_name: { type: "string", "x-sensitivity": "pii" },
        last_name: { type: "string", "x-sensitivity": "pii" },
        email: { type: "string", format: "email", "x-sensitivity": "pii" },
        phone: { type: "string", "x-sensitivity": "pii" },
        account_id: { type: "string", "x-sensitivity": "internal" },
        correlation_id: { type: "string", format: "uuid", "x-sensitivity": "internal" },
        sync_status: { type: "string", enum: ["synced", "pending", "error"] },
        last_modified: { type: "string", format: "date-time" },
      },
    }, null, 2)
  );
  files.push(`${prefix}-common/json-schema/contact.schema.json`);

  write(
    path.join(commonDir, "json-schema/account.schema.json"),
    JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "orca.canonical.account",
      title: "Canonical Account",
      type: "object",
      required: ["name"],
      properties: {
        sf_id: { type: "string", maxLength: 18, "x-sensitivity": "internal" },
        name: { type: "string" },
        industry: { type: "string" },
        phone: { type: "string", "x-sensitivity": "pii" },
        website: { type: "string" },
        correlation_id: { type: "string", format: "uuid", "x-sensitivity": "internal" },
        sync_status: { type: "string", enum: ["synced", "pending", "error"] },
        last_modified: { type: "string", format: "date-time" },
      },
    }, null, 2)
  );
  files.push(`${prefix}-common/json-schema/account.schema.json`);

  write(
    path.join(commonDir, "json-schema/sync-event.schema.json"),
    JSON.stringify({
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "orca.canonical.sync-event",
      title: "Sync Event",
      type: "object",
      required: ["correlation_id", "timestamp", "source", "target", "object_type", "action", "status"],
      properties: {
        correlation_id: { type: "string", format: "uuid" },
        timestamp: { type: "string", format: "date-time" },
        source: { type: "string", enum: ["sfdc", "neon"] },
        target: { type: "string", enum: ["neon", "sfdc"] },
        object_type: { type: "string", enum: ["contact", "account"] },
        object_id: { type: "string" },
        action: { type: "string", enum: ["create", "update", "delete"] },
        status: { type: "string", enum: ["success", "failure"] },
        duration_ms: { type: "integer" },
        error_message: { type: ["string", "null"] },
      },
    }, null, 2)
  );
  files.push(`${prefix}-common/json-schema/sync-event.schema.json`);

  // DataWeave masking module
  write(
    path.join(commonDir, "dwl/mask-pii.dwl"),
    `%dw 2.0

fun maskEmail(email) = if (email != null and sizeOf(email) > 3)
  email[0] ++ "***@" ++ ((email splitBy "@")[1] default "***")
  else "***"

fun maskPhone(phone) = if (phone != null and sizeOf(phone) > 4)
  "***" ++ phone[-4 to -1]
  else "***"

fun maskName(name) = if (name != null and sizeOf(name) > 1)
  name[0] ++ "***"
  else "***"

fun maskContact(contact) = contact update {
  case .email -> maskEmail(contact.email)
  case .phone -> maskPhone(contact.phone)
  case .first_name -> maskName(contact.first_name)
  case .last_name -> maskName(contact.last_name)
}

fun maskAccount(account) = account update {
  case .phone -> maskPhone(account.phone)
}
`
  );
  files.push(`${prefix}-common/dwl/mask-pii.dwl`);

  // Encrypt/Decrypt PII DataWeave modules
  write(
    path.join(commonDir, "dwl/encrypt-pii.dwl"),
    `%dw 2.0
import * from mask-pii

fun encryptPiiContact(contact, encryptFn) = contact update {
  case .email -> if (contact.email != null) encryptFn(contact.email, "pii:email") else null
  case .phone -> if (contact.phone != null) encryptFn(contact.phone, "pii:phone") else null
  case .first_name -> if (contact.first_name != null) encryptFn(contact.first_name, "pii:first_name") else null
  case .last_name -> if (contact.last_name != null) encryptFn(contact.last_name, "pii:last_name") else null
}

fun encryptPiiAccount(account, encryptFn) = account update {
  case .phone -> if (account.phone != null) encryptFn(account.phone, "pii:phone") else null
}
`
  );
  files.push(`${prefix}-common/dwl/encrypt-pii.dwl`);

  write(
    path.join(commonDir, "dwl/decrypt-pii.dwl"),
    `%dw 2.0

fun decryptPiiContact(contact, decryptFn) = contact update {
  case .email -> if (contact.email != null) decryptFn(contact.email, "pii:email") else null
  case .phone -> if (contact.phone != null) decryptFn(contact.phone, "pii:phone") else null
  case .first_name -> if (contact.first_name != null) decryptFn(contact.first_name, "pii:first_name") else null
  case .last_name -> if (contact.last_name != null) decryptFn(contact.last_name, "pii:last_name") else null
}

fun decryptPiiAccount(account, decryptFn) = account update {
  case .phone -> if (account.phone != null) decryptFn(account.phone, "pii:phone") else null
}
`
  );
  files.push(`${prefix}-common/dwl/decrypt-pii.dwl`);

  // Crypto config for Mule Cryptography Module
  write(
    path.join(commonDir, "mule/crypto-config.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns:crypto="http://www.mulesoft.org/schema/mule/crypto"
      xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/crypto http://www.mulesoft.org/schema/mule/crypto/current/mule-crypto.xsd">

    <crypto:jce-config name="Crypto_Config" keystore="\${crypto.keystore.path}" password="\${crypto.keystore.password}" type="JCEKS" />

    <!-- Encrypt PII sub-flow: set payload fields through DW before publishing to Kafka -->
    <sub-flow name="encrypt-pii-contact-subflow">
        <crypto:jce-encrypt config-ref="Crypto_Config" algorithm="AES" keyName="\${crypto.key.alias}">
            <crypto:content>#[output application/java --- write(payload.email, "application/java")]</crypto:content>
        </crypto:jce-encrypt>
        <set-variable variableName="encEmail" value="#[payload]" />
        <set-payload value="#[vars.originalPayload update { case .email -> vars.encEmail }]" />
    </sub-flow>

    <!-- Decrypt PII sub-flow: after consuming from Kafka, before DB/SF upsert -->
    <sub-flow name="decrypt-pii-contact-subflow">
        <crypto:jce-decrypt config-ref="Crypto_Config" algorithm="AES" keyName="\${crypto.key.alias}">
            <crypto:content>#[output application/java --- write(payload.email, "application/java")]</crypto:content>
        </crypto:jce-decrypt>
        <set-variable variableName="decEmail" value="#[output text/plain --- payload]" />
        <set-payload value="#[vars.originalPayload update { case .email -> vars.decEmail }]" />
    </sub-flow>
</mule>
`
  );
  files.push(`${prefix}-common/mule/crypto-config.xml`);

  return files;
}

// ─── CONVENTIONS.md ───────────────────────────────────────────────────────────

function scaffoldConventions(basePath: string, prefix: string): string[] {
  write(
    path.join(basePath, `${prefix}-common`, "CONVENTIONS.md"),
    `# Naming & Code Conventions

## Mule Application Artifacts

| Element               | Convention                            | Example                                    |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| Mule app artifact     | \`{prefix}-{layer}-{domain}-api\`       | \`myproj-sf-system-api\`                     |
| Mule flow name        | \`{verb}-{object}-{qualifier}-flow\`    | \`consume-sfdc-contacts-cdc-flow\`           |
| Mule sub-flow         | \`{verb}-{object}-{qualifier}-subflow\` | \`transform-contact-to-canonical-subflow\`   |
| Config ref            | \`{Type}_Config\`                       | \`Kafka_Producer_Config\`, \`Database_Config\` |
| HTTP listener         | \`{AppName}_HTTP_Listener\`             | \`DB_System_API_HTTP_Listener\`              |

## Kafka Topics

| Element               | Convention                            | Example                                    |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| Topic name            | \`orca.{source}.{object}.{event}\`      | \`orca.sfdc.contacts.cdc\`                   |
| Consumer group        | \`orca.{app}.{object}.consumer\`        | \`orca.db-system-api.contacts.consumer\`     |
| DLQ topic             | \`orca.dlq.sync-failures\`              |                                            |
| Audit topic           | \`orca.audit.sync-events\`              |                                            |

## Database

| Element               | Convention                            | Example                                    |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| Table name            | snake_case plural                     | \`contacts\`, \`accounts\`, \`sync_events\`     |
| Column name           | snake_case                            | \`sf_id\`, \`first_name\`, \`last_modified\`     |
| Index name            | \`idx_{table}_{column}\`                | \`idx_contacts_sf_id\`                       |
| Trigger name          | \`trg_{table}_{action}\`                | \`trg_contacts_modified\`                    |

## API Design

| Element               | Convention                            | Example                                    |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| API path              | \`/api/{plural-noun}\`                  | \`/api/contacts\`, \`/api/accounts\`           |
| DataWeave module      | \`{source}-{object}-to-{target}.dwl\`   | \`sfdc-contact-to-canonical.dwl\`            |
| Config property       | \`{category}.{subcategory}.{name}\`     | \`kafka.bootstrap.servers\`, \`sf.login.url\`  |
| Correlation ID header | \`X-Correlation-Id\`                    |                                            |

## Canonical Data Model

- All field names use **snake_case** in APIs, Kafka messages, and database columns
- Salesforce-specific field names (\`Id\`, \`FirstName\`) are mapped at the boundary in sf-system-api only
- Kafka messages serialize as JSON conforming to the schemas in \`json-schema/\`

## Security & PII Handling

### Field Classification

Fields are annotated with \`(x-sensitivity)\` in RAML and \`x-sensitivity\` in JSON Schema:

| Sensitivity | Fields                                  | Treatment                                     |
| ----------- | --------------------------------------- | --------------------------------------------- |
| \`pii\`       | email, phone, first_name, last_name     | Encrypted in Kafka, masked in logs            |
| \`pci\`       | card_number, cvv, expiry                | Encrypted at rest, never logged               |
| \`secret\`    | password, api_key, api_secret, tokens   | Vault-only storage, full masking              |
| \`internal\`  | sf_id, account_id, correlation_id       | Not encrypted, safe to log                    |
| \`public\`    | sync_status, industry, website          | No restrictions                               |

### Encryption

- **In transit (Kafka)**: PII fields encrypted via Mule Cryptography Module (AES/GCM) before \`kafka:publish\`, decrypted after \`kafka:consumer\`
- **At rest (Neon)**: Optional \`pgcrypto\` column-level encryption (see \`sql/002_enable_encryption.sql\`)
- **Vault (Orca platform)**: AES-256-GCM whole-file encryption with HKDF-derived sub-keys per field context

### Masking

- **Mule logs**: Only sf_id and correlationId logged (no PII). Email regex filter in Log4j2 as safety net.
- **API responses**: PII fields masked using \`mask-pii.dwl\` module when needed
- **Orca platform**: \`maskPayload()\` utility auto-detects and masks PII in request logs

### Correlation ID

- Header: \`X-Correlation-Id\` (UUID v4)
- Propagated: Express middleware -> Frontend API client -> Mule HTTP -> Kafka headers -> Audit trail
- Always included in error responses and sync event payloads
`
  );
  return [`${prefix}-common/CONVENTIONS.md`];
}

// ─── Common Mule XML generators ──────────────────────────────────────────────

function globalErrorHandlerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <error-handler name="Global_Error_Handler">
        <on-error-continue type="APIKIT:BAD_REQUEST">
            <ee:transform>
                <ee:message>
                    <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
    error: "BAD_REQUEST",
    message: error.description,
    correlationId: correlationId,
    timestamp: now() as String {format: "yyyy-MM-dd'T'HH:mm:ss.SSSZ"}
}]]></ee:set-payload>
                </ee:message>
            </ee:transform>
            <set-variable variableName="httpStatus" value="400" />
        </on-error-continue>

        <on-error-continue type="APIKIT:NOT_FOUND">
            <ee:transform>
                <ee:message>
                    <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
    error: "NOT_FOUND",
    message: error.description,
    correlationId: correlationId,
    timestamp: now() as String {format: "yyyy-MM-dd'T'HH:mm:ss.SSSZ"}
}]]></ee:set-payload>
                </ee:message>
            </ee:transform>
            <set-variable variableName="httpStatus" value="404" />
        </on-error-continue>

        <on-error-propagate type="ANY">
            <logger level="ERROR" message="Unhandled error [#[error.errorType]]: #[error.description] | correlationId=#[correlationId]" />
            <ee:transform>
                <ee:message>
                    <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
    error: "INTERNAL_SERVER_ERROR",
    message: error.description default "An unexpected error occurred",
    correlationId: correlationId,
    timestamp: now() as String {format: "yyyy-MM-dd'T'HH:mm:ss.SSSZ"}
}]]></ee:set-payload>
                </ee:message>
            </ee:transform>
            <set-variable variableName="httpStatus" value="500" />
        </on-error-propagate>
    </error-handler>
</mule>
`;
}

function log4j2Config(appName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="INFO">
    <Appenders>
        <Console name="ConsoleRaw" target="SYSTEM_OUT">
            <JsonLayout compact="true" eventEol="true" stacktraceAsString="true">
                <KeyValuePair key="app" value="${appName}" />
                <KeyValuePair key="correlationId" value="\${ctx:correlationId}" />
                <KeyValuePair key="flowName" value="\${ctx:flowName}" />
            </JsonLayout>
        </Console>
        <Rewrite name="Console">
            <AppenderRef ref="ConsoleRaw" />
            <LogRewritePolicy>
                <KeyValuePair key="message" value="" />
            </LogRewritePolicy>
        </Rewrite>
        <RollingFile name="RollingFile" fileName="logs/${appName}.log"
                     filePattern="logs/${appName}-%d{yyyy-MM-dd}.log">
            <JsonLayout compact="true" eventEol="true" stacktraceAsString="true">
                <KeyValuePair key="app" value="${appName}" />
                <KeyValuePair key="correlationId" value="\${ctx:correlationId}" />
                <KeyValuePair key="flowName" value="\${ctx:flowName}" />
            </JsonLayout>
            <Policies>
                <TimeBasedTriggeringPolicy />
                <SizeBasedTriggeringPolicy size="10MB" />
            </Policies>
            <DefaultRolloverStrategy max="7" />
        </RollingFile>
    </Appenders>
    <Loggers>
        <AsyncLogger name="org.mule" level="INFO" />
        <AsyncLogger name="com.mulesoft" level="INFO" />
        <AsyncLogger name="org.apache.kafka" level="WARN" />
        <Root level="INFO">
            <AppenderRef ref="Console" />
            <AppenderRef ref="RollingFile" />
        </Root>
    </Loggers>
</Configuration>

<!-- PII Redaction Note:
     Logger messages in generated flows use only sf_id and correlationId (no PII).
     For additional production hardening, deploy a custom Log4j2 RewritePolicy
     plugin that regex-replaces email patterns [a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}
     and phone patterns with masked equivalents. -->
`;
}

function wrapSyncEventDwl(): string {
  return `%dw 2.0
output application/json
---
{
    correlation_id: vars.correlationId default correlationId,
    timestamp: now() as String {format: "yyyy-MM-dd'T'HH:mm:ss.SSSZ"},
    source: vars.syncSource,
    target: vars.syncTarget,
    object_type: vars.objectType,
    object_id: vars.objectId default "",
    action: vars.syncAction default "update",
    status: vars.syncStatus default "success",
    duration_ms: vars.durationMs default 0,
    error_message: vars.errorMessage default null
}
`;
}

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
  Contact: !include ../../common/raml/types/Contact.raml
  Account: !include ../../common/raml/types/Account.raml

/contacts:
  get:
    description: List all Salesforce contacts (read path — HTTP)
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

  /{id}:
    get:
      responses:
        200:
          body:
            application/json:
              type: Contact

/accounts:
  get:
    description: List all Salesforce accounts (read path — HTTP)
    queryParameters:
      lastModified:
        type: string
        required: false
    responses:
      200:
        body:
          application/json:
            type: Account[]

  /{id}:
    get:
      responses:
        200:
          body:
            application/json:
              type: Account

/health:
  get:
    description: Health check
    responses:
      200:
        body:
          application/json:
            example: |
              {"status": "UP", "service": "sf-system-api"}
`
  );
  files.push(`${name}/src/main/resources/api/sf-system-api.raml`);

  // Main Mule XML — HTTP read endpoints only (writes handled by Kafka consumer)
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

    <http:listener-config name="SF_System_API_HTTP_Listener">
        <http:listener-connection host="0.0.0.0" port="\${http.port}" />
    </http:listener-config>

    <salesforce:sfdc-config name="Salesforce_Config">
        <salesforce:basic-connection
            username="\${sf.username}"
            password="\${sf.password}"
            securityToken="\${sf.security.token}"
            url="\${sf.login.url}" />
    </salesforce:sfdc-config>

    <!-- GET /api/health -->
    <flow name="get-health-flow">
        <http:listener config-ref="SF_System_API_HTTP_Listener" path="/api/health" method="GET" />
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ status: "UP", service: "sf-system-api" }]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/contacts (read path stays HTTP) -->
    <flow name="get-sfdc-contacts-flow">
        <http:listener config-ref="SF_System_API_HTTP_Listener" path="/api/contacts" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, FirstName, LastName, Email, Phone, AccountId, LastModifiedDate
                FROM Contact ORDER BY LastModifiedDate DESC
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload map {
    sf_id: $.Id,
    first_name: $.FirstName default "",
    last_name: $.LastName default "",
    email: $.Email default "",
    phone: $.Phone default "",
    account_id: $.AccountId default ""
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/contacts/{id} -->
    <flow name="get-sfdc-contact-by-id-flow">
        <http:listener config-ref="SF_System_API_HTTP_Listener" path="/api/contacts/{id}" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, FirstName, LastName, Email, Phone, AccountId
                FROM Contact WHERE Id = ':id'
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
if (sizeOf(payload) > 0) {
    sf_id: payload[0].Id,
    first_name: payload[0].FirstName default "",
    last_name: payload[0].LastName default "",
    email: payload[0].Email default "",
    phone: payload[0].Phone default ""
} else null]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/accounts (read path stays HTTP) -->
    <flow name="get-sfdc-accounts-flow">
        <http:listener config-ref="SF_System_API_HTTP_Listener" path="/api/accounts" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, Name, Industry, Phone, Website, LastModifiedDate
                FROM Account ORDER BY LastModifiedDate DESC
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
payload map {
    sf_id: $.Id,
    name: $.Name default "",
    industry: $.Industry default "",
    phone: $.Phone default "",
    website: $.Website default ""
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- GET /api/accounts/{id} -->
    <flow name="get-sfdc-account-by-id-flow">
        <http:listener config-ref="SF_System_API_HTTP_Listener" path="/api/accounts/{id}" method="GET" />
        <salesforce:query config-ref="Salesforce_Config">
            <salesforce:salesforce-query>
                SELECT Id, Name, Industry, Phone, Website
                FROM Account WHERE Id = ':id'
            </salesforce:salesforce-query>
        </salesforce:query>
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
if (sizeOf(payload) > 0) {
    sf_id: payload[0].Id,
    name: payload[0].Name default "",
    industry: payload[0].Industry default "",
    phone: payload[0].Phone default "",
    website: payload[0].Website default ""
} else null]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/sf-system-api.xml`);

  // Kafka consumer flows — upsert into Salesforce from neon pending topics
  write(
    path.join(p, "src/main/mule/kafka-consumer-contacts-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:salesforce="http://www.mulesoft.org/schema/mule/salesforce"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/salesforce http://www.mulesoft.org/schema/mule/salesforce/current/mule-salesforce.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <flow name="consume-neon-contacts-pending-flow">
        <kafka:consumer config-ref="Kafka_Consumer_Config" topic="\${kafka.topic.neon.contacts}" />
        <set-variable variableName="originalPayload" value="#[payload]" />
        <flow-ref name="decrypt-pii-contact-subflow" />
        <logger level="INFO" message="Kafka: consuming neon contact pending event | correlationId=#[correlationId]" />
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
var contact = payload
---
{
    sf_id: contact.sf_id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    phone: contact.phone default "",
    account_id: contact.account_id default ""
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
        <ee:transform>
            <ee:message>
                <ee:set-payload resource="dwl/canonical-contact-to-sfdc.dwl" />
            </ee:message>
        </ee:transform>
        <salesforce:upsert config-ref="Salesforce_Config" objectType="Contact" externalIdFieldName="Email" />
        <logger level="INFO" message="Salesforce contact upserted from neon pending | correlationId=#[correlationId]" />
        <error-handler ref="Global_Error_Handler" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/kafka-consumer-contacts-flow.xml`);

  write(
    path.join(p, "src/main/mule/kafka-consumer-accounts-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:salesforce="http://www.mulesoft.org/schema/mule/salesforce"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/salesforce http://www.mulesoft.org/schema/mule/salesforce/current/mule-salesforce.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <flow name="consume-neon-accounts-pending-flow">
        <kafka:consumer config-ref="Kafka_Consumer_Config" topic="\${kafka.topic.neon.accounts}" />
        <set-variable variableName="originalPayload" value="#[payload]" />
        <flow-ref name="decrypt-pii-account-subflow" />
        <logger level="INFO" message="Kafka: consuming neon account pending event | correlationId=#[correlationId]" />
        <ee:transform>
            <ee:message>
                <ee:set-payload resource="dwl/canonical-account-to-sfdc.dwl" />
            </ee:message>
        </ee:transform>
        <salesforce:upsert config-ref="Salesforce_Config" objectType="Account" externalIdFieldName="Name" />
        <logger level="INFO" message="Salesforce account upserted from neon pending | correlationId=#[correlationId]" />
        <error-handler ref="Global_Error_Handler" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/kafka-consumer-accounts-flow.xml`);

  // Kafka global config
  write(
    path.join(p, "src/main/mule/global-config.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd">

    <configuration-properties file="config.properties" />

    <kafka:consumer-config name="Kafka_Consumer_Config">
        <kafka:consumer-plaintext-connection>
            <kafka:bootstrap-servers>
                <kafka:bootstrap-server value="\${kafka.bootstrap.servers}" />
            </kafka:bootstrap-servers>
            <kafka:sasl-plain-auth username="\${kafka.api.key}" password="\${kafka.api.secret}" />
        </kafka:consumer-plaintext-connection>
        <kafka:consumer-config groupId="orca.sf-system-api.consumer" />
    </kafka:consumer-config>
</mule>
`
  );
  files.push(`${name}/src/main/mule/global-config.xml`);

  // Global error handler
  write(path.join(p, "src/main/mule/global-error-handler.xml"), globalErrorHandlerXml());
  files.push(`${name}/src/main/mule/global-error-handler.xml`);

  // DataWeave modules
  write(
    path.join(p, "src/main/resources/dwl/canonical-contact-to-sfdc.dwl"),
    `%dw 2.0
output application/java
---
[{
    FirstName: payload.first_name,
    LastName: payload.last_name,
    Email: payload.email,
    Phone: payload.phone default "",
    AccountId: payload.account_id default ""
}]
`
  );
  files.push(`${name}/src/main/resources/dwl/canonical-contact-to-sfdc.dwl`);

  write(
    path.join(p, "src/main/resources/dwl/canonical-account-to-sfdc.dwl"),
    `%dw 2.0
output application/java
---
[{
    Name: payload.name,
    Industry: payload.industry default "",
    Phone: payload.phone default "",
    Website: payload.website default ""
}]
`
  );
  files.push(`${name}/src/main/resources/dwl/canonical-account-to-sfdc.dwl`);

  // config.properties
  write(
    path.join(p, "src/main/resources/config.properties"),
    `http.port=8082
sf.username=\${SF_USERNAME}
sf.password=\${SF_PASSWORD}
sf.security.token=\${SF_SECURITY_TOKEN}
sf.login.url=https://login.salesforce.com
kafka.bootstrap.servers=\${KAFKA_BOOTSTRAP_SERVERS}
kafka.api.key=\${KAFKA_API_KEY}
kafka.api.secret=\${KAFKA_API_SECRET}
kafka.topic.neon.contacts=orca.neon.contacts.pending
kafka.topic.neon.accounts=orca.neon.accounts.pending
crypto.keystore.path=\${ORCA_CRYPTO_KEYSTORE_PATH}
crypto.keystore.password=\${ORCA_CRYPTO_KEYSTORE_PASSWORD}
crypto.key.alias=\${ORCA_CRYPTO_KEY_ALIAS}
`
  );
  files.push(`${name}/src/main/resources/config.properties`);

  // Log4j2
  write(path.join(p, "src/main/resources/log4j2.xml"), log4j2Config(name));
  files.push(`${name}/src/main/resources/log4j2.xml`);

  // pom.xml
  const sfDeps = `        <dependency>
            <groupId>com.mulesoft.connectors</groupId>
            <artifactId>mule-salesforce-connector</artifactId>
            <version>10.20.0</version>
            <classifier>mule-plugin</classifier>
        </dependency>
${kafkaConnectorDep}
${cryptoModuleDep}
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
    `# ${name}\n\nSalesforce System API — Read endpoints (HTTP) + Kafka consumers for write operations.\n\nPart of the SF-Postgres Bidirectional Sync use case scaffolded by Orca.\n\n## Architecture\n\n- **HTTP GET** endpoints for reading contacts/accounts from Salesforce\n- **Kafka consumers** on \`orca.neon.contacts.pending\` and \`orca.neon.accounts.pending\` for upserting into Salesforce\n- Canonical data model mapping at the boundary\n\n## Endpoints\n\n- \`GET /api/contacts\` — list contacts\n- \`GET /api/contacts/{id}\` — get contact by ID\n- \`GET /api/accounts\` — list accounts\n- \`GET /api/accounts/{id}\` — get account by ID\n- \`GET /api/health\` — health check\n\n## Port: 8082\n`
  );
  files.push(`${name}/README.md`);

  // Tests
  write(
    path.join(p, "tests/test_sf_system_api.py"),
    `import requests
import pytest

BASE_URL = "http://localhost:8082"

class TestSfHealth:
    def test_health_200(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
        assert resp.json().get("status") == "UP"

class TestSfContacts:
    def test_get_contacts_200(self):
        resp = requests.get(f"{BASE_URL}/api/contacts")
        assert resp.status_code == 200

    def test_get_contacts_returns_list(self):
        resp = requests.get(f"{BASE_URL}/api/contacts")
        data = resp.json()
        assert isinstance(data, list)

class TestSfAccounts:
    def test_get_accounts_200(self):
        resp = requests.get(f"{BASE_URL}/api/accounts")
        assert resp.status_code == 200
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
  Contact: !include ../../common/raml/types/Contact.raml
  Account: !include ../../common/raml/types/Account.raml
  SyncEvent: !include ../../common/raml/types/SyncEvent.raml

/contacts:
  get:
    description: List all contacts from PostgreSQL (read path — HTTP)
    queryParameters:
      since:
        type: string
        required: false
        description: ISO datetime — return rows modified after this time
      status:
        type: string
        required: false
        description: Filter by sync_status (pending, synced, error)
    responses:
      200:
        body:
          application/json:
            type: Contact[]

/accounts:
  get:
    description: List all accounts from PostgreSQL (read path — HTTP)
    queryParameters:
      since:
        type: string
        required: false
      status:
        type: string
        required: false
    responses:
      200:
        body:
          application/json:
            type: Account[]

/sync-events:
  get:
    description: Query audit trail of sync events
    queryParameters:
      correlation_id:
        type: string
        required: false
      object_type:
        type: string
        required: false
      status:
        type: string
        required: false
      limit:
        type: integer
        required: false
        default: 50
    responses:
      200:
        body:
          application/json:
            type: SyncEvent[]

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

  // SQL migration — extended with sync_events and sync_state
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
    correlation_id UUID,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_sf_id ON contacts(sf_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_last_modified ON contacts(last_modified);
CREATE INDEX IF NOT EXISTS idx_contacts_sync_status ON contacts(sync_status);
CREATE INDEX IF NOT EXISTS idx_contacts_correlation_id ON contacts(correlation_id);

-- Accounts table synced with Salesforce
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    sf_id VARCHAR(18) UNIQUE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    correlation_id UUID,
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_sf_id ON accounts(sf_id);
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);
CREATE INDEX IF NOT EXISTS idx_accounts_last_modified ON accounts(last_modified);
CREATE INDEX IF NOT EXISTS idx_accounts_sync_status ON accounts(sync_status);
CREATE INDEX IF NOT EXISTS idx_accounts_correlation_id ON accounts(correlation_id);

-- Sync events audit trail (populated by Kafka consumer from orca.audit.sync-events)
CREATE TABLE IF NOT EXISTS sync_events (
    id SERIAL PRIMARY KEY,
    correlation_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    source VARCHAR(20) NOT NULL,
    target VARCHAR(20) NOT NULL,
    object_type VARCHAR(20) NOT NULL,
    object_id VARCHAR(50),
    action VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    duration_ms INTEGER,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_events_correlation_id ON sync_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_sync_events_timestamp ON sync_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_sync_events_object_type ON sync_events(object_type);
CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);

-- Sync state tracking (poll cursor for scheduler)
CREATE TABLE IF NOT EXISTS sync_state (
    id SERIAL PRIMARY KEY,
    sync_direction VARCHAR(20) NOT NULL,
    object_type VARCHAR(20) NOT NULL,
    last_poll_time TIMESTAMPTZ,
    last_successful_sync TIMESTAMPTZ,
    records_synced INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sync_direction, object_type)
);

-- Seed sync state rows
INSERT INTO sync_state (sync_direction, object_type, last_poll_time)
VALUES
    ('sfdc_to_neon', 'contact', '1970-01-01T00:00:00Z'),
    ('sfdc_to_neon', 'account', '1970-01-01T00:00:00Z'),
    ('neon_to_sfdc', 'contact', '1970-01-01T00:00:00Z'),
    ('neon_to_sfdc', 'account', '1970-01-01T00:00:00Z')
ON CONFLICT (sync_direction, object_type) DO NOTHING;

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

  // SQL migration — optional pgcrypto for at-rest PII encryption
  write(
    path.join(p, "src/main/resources/sql/002_enable_encryption.sql"),
    `-- Optional: Enable pgcrypto for at-rest PII encryption in Neon PostgreSQL
-- Neon supports pgcrypto out of the box on all plans.
-- Run this migration after 001_create_tables.sql when you want column-level encryption.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Example: encrypt email column in contacts
-- The crypto key should be stored as a PostgreSQL configuration parameter or env var.
-- SET app.crypto_key = 'your-secret-key-here';

-- To encrypt existing data:
-- ALTER TABLE contacts ADD COLUMN email_encrypted BYTEA;
-- UPDATE contacts SET email_encrypted = pgp_sym_encrypt(email, current_setting('app.crypto_key'));

-- To read encrypted data:
-- SELECT pgp_sym_decrypt(email_encrypted, current_setting('app.crypto_key')) AS email FROM contacts;

-- For new inserts, use pgp_sym_encrypt in your Mule DB connector:
-- INSERT INTO contacts (email_encrypted, ...) VALUES (pgp_sym_encrypt(:email, current_setting('app.crypto_key')), ...);

-- Note: This is opt-in. The primary encryption layer is the Mule Cryptography Module
-- which encrypts PII fields in transit (Kafka messages). This pgcrypto approach adds
-- defense-in-depth for at-rest data in PostgreSQL.
`
  );
  files.push(`${name}/src/main/resources/sql/002_enable_encryption.sql`);

  // Main Mule XML — HTTP read endpoints (writes via Kafka consumers)
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

    <http:listener-config name="DB_System_API_HTTP_Listener">
        <http:listener-connection host="0.0.0.0" port="\${http.port}" />
    </http:listener-config>

    <db:config name="Database_Config">
        <db:generic-connection url="\${db.url}" driverClassName="org.postgresql.Driver" />
    </db:config>

    <!-- GET /api/health -->
    <flow name="get-health-check-flow">
        <http:listener config-ref="DB_System_API_HTTP_Listener" path="/api/health" method="GET" />
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

    <!-- GET /api/contacts (read path — HTTP) -->
    <flow name="get-neon-contacts-flow">
        <http:listener config-ref="DB_System_API_HTTP_Listener" path="/api/contacts" method="GET" />
        <db:select config-ref="Database_Config">
            <db:sql>SELECT id, sf_id, first_name, last_name, email, phone, account_id, correlation_id, last_modified, sync_status FROM contacts ORDER BY last_modified DESC</db:sql>
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

    <!-- GET /api/accounts (read path — HTTP) -->
    <flow name="get-neon-accounts-flow">
        <http:listener config-ref="DB_System_API_HTTP_Listener" path="/api/accounts" method="GET" />
        <db:select config-ref="Database_Config">
            <db:sql>SELECT id, sf_id, name, industry, phone, website, correlation_id, last_modified, sync_status FROM accounts ORDER BY last_modified DESC</db:sql>
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

    <!-- GET /api/sync-events (audit trail) -->
    <flow name="get-sync-events-flow">
        <http:listener config-ref="DB_System_API_HTTP_Listener" path="/api/sync-events" method="GET" />
        <db:select config-ref="Database_Config">
            <db:sql>SELECT id, correlation_id, timestamp, source, target, object_type, object_id, action, status, duration_ms, error_message FROM sync_events ORDER BY timestamp DESC LIMIT 50</db:sql>
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
</mule>
`
  );
  files.push(`${name}/src/main/mule/db-system-api.xml`);

  // Kafka consumer flow — contacts from sfdc CDC topic
  write(
    path.join(p, "src/main/mule/kafka-consumer-contacts-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:db="http://www.mulesoft.org/schema/mule/db"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/db http://www.mulesoft.org/schema/mule/db/current/mule-db.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <flow name="consume-sfdc-contacts-cdc-flow">
        <kafka:consumer config-ref="Kafka_Consumer_Config" topic="\${kafka.topic.sfdc.contacts}" />
        <set-variable variableName="originalPayload" value="#[payload]" />
        <flow-ref name="decrypt-pii-contact-subflow" />
        <logger level="INFO" message="Kafka: consuming sfdc contact CDC event | correlationId=#[correlationId]" />
        <db:insert config-ref="Database_Config">
            <db:sql>
                INSERT INTO contacts (sf_id, first_name, last_name, email, phone, account_id, correlation_id, sync_status)
                VALUES (:sfId, :firstName, :lastName, :email, :phone, :accountId, :correlationId::uuid, 'synced')
                ON CONFLICT (sf_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    account_id = EXCLUDED.account_id,
                    correlation_id = EXCLUDED.correlation_id,
                    sync_status = 'synced',
                    last_modified = NOW()
            </db:sql>
            <db:input-parameters><![CDATA[#[{
                sfId: payload.sf_id default "",
                firstName: payload.first_name,
                lastName: payload.last_name,
                email: payload.email,
                phone: payload.phone default "",
                accountId: payload.account_id default "",
                correlationId: payload.correlation_id default correlationId
            }]]]></db:input-parameters>
        </db:insert>
        <logger level="INFO" message="Neon contact upserted from sfdc CDC | correlationId=#[correlationId]" />
        <error-handler ref="Global_Error_Handler" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/kafka-consumer-contacts-flow.xml`);

  // Kafka consumer flow — accounts from sfdc CDC topic
  write(
    path.join(p, "src/main/mule/kafka-consumer-accounts-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:db="http://www.mulesoft.org/schema/mule/db"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/db http://www.mulesoft.org/schema/mule/db/current/mule-db.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <flow name="consume-sfdc-accounts-cdc-flow">
        <kafka:consumer config-ref="Kafka_Consumer_Config" topic="\${kafka.topic.sfdc.accounts}" />
        <set-variable variableName="originalPayload" value="#[payload]" />
        <flow-ref name="decrypt-pii-account-subflow" />
        <logger level="INFO" message="Kafka: consuming sfdc account CDC event | correlationId=#[correlationId]" />
        <db:insert config-ref="Database_Config">
            <db:sql>
                INSERT INTO accounts (sf_id, name, industry, phone, website, correlation_id, sync_status)
                VALUES (:sfId, :name, :industry, :phone, :website, :correlationId::uuid, 'synced')
                ON CONFLICT (sf_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    industry = EXCLUDED.industry,
                    phone = EXCLUDED.phone,
                    website = EXCLUDED.website,
                    correlation_id = EXCLUDED.correlation_id,
                    sync_status = 'synced',
                    last_modified = NOW()
            </db:sql>
            <db:input-parameters><![CDATA[#[{
                sfId: payload.sf_id default "",
                name: payload.name,
                industry: payload.industry default "",
                phone: payload.phone default "",
                website: payload.website default "",
                correlationId: payload.correlation_id default correlationId
            }]]]></db:input-parameters>
        </db:insert>
        <logger level="INFO" message="Neon account upserted from sfdc CDC | correlationId=#[correlationId]" />
        <error-handler ref="Global_Error_Handler" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/kafka-consumer-accounts-flow.xml`);

  // Kafka consumer flow — audit events to sync_events table
  write(
    path.join(p, "src/main/mule/kafka-consumer-audit-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:db="http://www.mulesoft.org/schema/mule/db"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/db http://www.mulesoft.org/schema/mule/db/current/mule-db.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <flow name="consume-audit-sync-events-flow">
        <kafka:consumer config-ref="Kafka_Consumer_Config" topic="\${kafka.topic.audit}" />
        <logger level="INFO" message="Kafka: consuming audit sync event | correlationId=#[payload.correlation_id]" />
        <db:insert config-ref="Database_Config">
            <db:sql>
                INSERT INTO sync_events (correlation_id, timestamp, source, target, object_type, object_id, action, status, duration_ms, error_message)
                VALUES (:correlationId::uuid, :timestamp::timestamptz, :source, :target, :objectType, :objectId, :action, :status, :durationMs, :errorMessage)
            </db:sql>
            <db:input-parameters><![CDATA[#[{
                correlationId: payload.correlation_id,
                timestamp: payload.timestamp,
                source: payload.source,
                target: payload.target,
                objectType: payload.object_type,
                objectId: payload.object_id default "",
                action: payload.action,
                status: payload.status,
                durationMs: payload.duration_ms default 0,
                errorMessage: payload.error_message
            }]]]></db:input-parameters>
        </db:insert>
        <logger level="DEBUG" message="Audit event persisted to sync_events table" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/kafka-consumer-audit-flow.xml`);

  // Kafka global config for db-system-api
  write(
    path.join(p, "src/main/mule/global-config.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd">

    <configuration-properties file="config.properties" />

    <kafka:consumer-config name="Kafka_Consumer_Config">
        <kafka:consumer-plaintext-connection>
            <kafka:bootstrap-servers>
                <kafka:bootstrap-server value="\${kafka.bootstrap.servers}" />
            </kafka:bootstrap-servers>
            <kafka:sasl-plain-auth username="\${kafka.api.key}" password="\${kafka.api.secret}" />
        </kafka:consumer-plaintext-connection>
        <kafka:consumer-config groupId="orca.db-system-api.consumer" />
    </kafka:consumer-config>
</mule>
`
  );
  files.push(`${name}/src/main/mule/global-config.xml`);

  // Global error handler
  write(path.join(p, "src/main/mule/global-error-handler.xml"), globalErrorHandlerXml());
  files.push(`${name}/src/main/mule/global-error-handler.xml`);

  // Log4j2
  write(path.join(p, "src/main/resources/log4j2.xml"), log4j2Config(name));
  files.push(`${name}/src/main/resources/log4j2.xml`);

  // config.properties
  write(
    path.join(p, "src/main/resources/config.properties"),
    `http.port=8083
db.url=\${NEON_DATABASE_URL}
kafka.bootstrap.servers=\${KAFKA_BOOTSTRAP_SERVERS}
kafka.api.key=\${KAFKA_API_KEY}
kafka.api.secret=\${KAFKA_API_SECRET}
kafka.topic.sfdc.contacts=orca.sfdc.contacts.cdc
kafka.topic.sfdc.accounts=orca.sfdc.accounts.cdc
kafka.topic.audit=orca.audit.sync-events
crypto.keystore.path=\${ORCA_CRYPTO_KEYSTORE_PATH}
crypto.keystore.password=\${ORCA_CRYPTO_KEYSTORE_PASSWORD}
crypto.key.alias=\${ORCA_CRYPTO_KEY_ALIAS}
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
${kafkaConnectorDep}
${cryptoModuleDep}
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
    `# ${name}\n\nDatabase System API — Read endpoints (HTTP) + Kafka consumers for write operations + audit persistence.\n\nPart of the SF-Postgres Bidirectional Sync use case scaffolded by Orca.\n\n## Architecture\n\n- **HTTP GET** endpoints for reading contacts/accounts/sync-events from Neon PostgreSQL\n- **Kafka consumers** on \`orca.sfdc.contacts.cdc\`, \`orca.sfdc.accounts.cdc\` for upserting CDC events\n- **Kafka consumer** on \`orca.audit.sync-events\` for persisting audit trail\n- Includes SQL migration with sync_events and sync_state tables\n\n## Endpoints\n\n- \`GET /api/contacts\` — list contacts\n- \`GET /api/accounts\` — list accounts\n- \`GET /api/sync-events\` — query audit trail\n- \`GET /api/health\` — database connectivity check\n\n## Port: 8083\n\n## Database Setup\n\nRun: \`psql $NEON_DATABASE_URL -f src/main/resources/sql/001_create_tables.sql\`\n`
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

class TestDbAccounts:
    def test_get_accounts_200(self):
        resp = requests.get(f"{BASE_URL}/api/accounts")
        assert resp.status_code == 200

class TestDbSyncEvents:
    def test_get_sync_events_200(self):
        resp = requests.get(f"{BASE_URL}/api/sync-events")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
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

  // DataWeave mappings — SF CDC to canonical
  write(
    path.join(p, "src/main/resources/dwl/sfdc-contact-to-canonical.dwl"),
    `%dw 2.0
output application/json
---
{
    sf_id: payload.Id default "",
    first_name: payload.FirstName default "",
    last_name: payload.LastName default "",
    email: payload.Email default "",
    phone: payload.Phone default "",
    account_id: payload.AccountId default "",
    correlation_id: correlationId,
    sync_status: "synced"
}
`
  );
  files.push(`${name}/src/main/resources/dwl/sfdc-contact-to-canonical.dwl`);

  write(
    path.join(p, "src/main/resources/dwl/sfdc-account-to-canonical.dwl"),
    `%dw 2.0
output application/json
---
{
    sf_id: payload.Id default "",
    name: payload.Name default "",
    industry: payload.Industry default "",
    phone: payload.Phone default "",
    website: payload.Website default "",
    correlation_id: correlationId,
    sync_status: "synced"
}
`
  );
  files.push(`${name}/src/main/resources/dwl/sfdc-account-to-canonical.dwl`);

  // DataWeave — DB pending rows to canonical (for Kafka publish)
  write(
    path.join(p, "src/main/resources/dwl/db-contact-to-canonical.dwl"),
    `%dw 2.0
output application/json
---
{
    sf_id: payload.sf_id default "",
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone default "",
    account_id: payload.account_id default "",
    correlation_id: correlationId,
    sync_status: "pending"
}
`
  );
  files.push(`${name}/src/main/resources/dwl/db-contact-to-canonical.dwl`);

  write(
    path.join(p, "src/main/resources/dwl/db-account-to-canonical.dwl"),
    `%dw 2.0
output application/json
---
{
    sf_id: payload.sf_id default "",
    name: payload.name,
    industry: payload.industry default "",
    phone: payload.phone default "",
    website: payload.website default "",
    correlation_id: correlationId,
    sync_status: "pending"
}
`
  );
  files.push(`${name}/src/main/resources/dwl/db-account-to-canonical.dwl`);

  // Audit event wrapper
  write(
    path.join(p, "src/main/resources/dwl/wrap-sync-event.dwl"),
    wrapSyncEventDwl()
  );
  files.push(`${name}/src/main/resources/dwl/wrap-sync-event.dwl`);

  // Mule XML — SF CDC to Kafka (replaces sf-to-postgres-flow.xml)
  write(
    path.join(p, "src/main/mule/sf-to-kafka-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:salesforce="http://www.mulesoft.org/schema/mule/salesforce"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/salesforce http://www.mulesoft.org/schema/mule/salesforce/current/mule-salesforce.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <!-- SF CDC Contact -> Kafka topic orca.sfdc.contacts.cdc -->
    <flow name="capture-sfdc-contacts-cdc-flow">
        <salesforce:subscribe-channel-listener config-ref="Salesforce_CDC_Config"
            streamingType="CDC"
            channel="/data/ContactChangeEvent" />
        <logger level="INFO" message="CDC Contact event received | correlationId=#[correlationId]" />
        <set-variable variableName="startTime" value="#[now()]" />
        <foreach>
            <ee:transform>
                <ee:message>
                    <ee:set-payload resource="dwl/sfdc-contact-to-canonical.dwl" />
                </ee:message>
            </ee:transform>
            <set-variable variableName="originalPayload" value="#[payload]" />
            <flow-ref name="encrypt-pii-contact-subflow" />
            <kafka:publish config-ref="Kafka_Producer_Config" topic="\${kafka.topic.sfdc.contacts}">
                <kafka:message>
                    <kafka:key><![CDATA[#[payload.sf_id default correlationId]]]></kafka:key>
                    <kafka:headers><![CDATA[#[{'X-Correlation-Id': correlationId}]]]></kafka:headers>
                </kafka:message>
            </kafka:publish>
            <logger level="INFO" message="Published contact to Kafka sfdc.contacts.cdc | sf_id=#[payload.sf_id] | correlationId=#[correlationId]" />
        </foreach>
        <flow-ref name="publish-audit-event-subflow" />
        <error-handler ref="Global_Error_Handler" />
    </flow>

    <!-- SF CDC Account -> Kafka topic orca.sfdc.accounts.cdc -->
    <flow name="capture-sfdc-accounts-cdc-flow">
        <salesforce:subscribe-channel-listener config-ref="Salesforce_CDC_Config"
            streamingType="CDC"
            channel="/data/AccountChangeEvent" />
        <logger level="INFO" message="CDC Account event received | correlationId=#[correlationId]" />
        <set-variable variableName="startTime" value="#[now()]" />
        <foreach>
            <ee:transform>
                <ee:message>
                    <ee:set-payload resource="dwl/sfdc-account-to-canonical.dwl" />
                </ee:message>
            </ee:transform>
            <set-variable variableName="originalPayload" value="#[payload]" />
            <flow-ref name="encrypt-pii-account-subflow" />
            <kafka:publish config-ref="Kafka_Producer_Config" topic="\${kafka.topic.sfdc.accounts}">
                <kafka:message>
                    <kafka:key><![CDATA[#[payload.sf_id default correlationId]]]></kafka:key>
                    <kafka:headers><![CDATA[#[{'X-Correlation-Id': correlationId}]]]></kafka:headers>
                </kafka:message>
            </kafka:publish>
            <logger level="INFO" message="Published account to Kafka sfdc.accounts.cdc | sf_id=#[payload.sf_id] | correlationId=#[correlationId]" />
        </foreach>
        <flow-ref name="publish-audit-event-subflow" />
        <error-handler ref="Global_Error_Handler" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/sf-to-kafka-flow.xml`);

  // Mule XML — DB poll to Kafka (replaces postgres-to-sf-flow.xml)
  write(
    path.join(p, "src/main/mule/db-poll-to-kafka-flow.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <http:request-config name="DB_System_API_Poll">
        <http:request-connection host="localhost" port="\${db.system.api.port}" />
    </http:request-config>

    <!-- Poll DB for pending contacts -> Kafka topic orca.neon.contacts.pending -->
    <flow name="poll-neon-contacts-to-kafka-flow">
        <scheduler>
            <scheduling-strategy>
                <fixed-frequency frequency="\${poll.frequency.seconds}" timeUnit="SECONDS" />
            </scheduling-strategy>
        </scheduler>
        <logger level="DEBUG" message="Polling DB for pending contacts..." />
        <http:request config-ref="DB_System_API_Poll" method="GET" path="/api/contacts">
            <http:query-params><![CDATA[#[{"status": "pending"}]]]></http:query-params>
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
                    <ee:set-payload resource="dwl/db-contact-to-canonical.dwl" />
                </ee:message>
            </ee:transform>
            <set-variable variableName="originalPayload" value="#[payload]" />
            <flow-ref name="encrypt-pii-contact-subflow" />
            <kafka:publish config-ref="Kafka_Producer_Config" topic="\${kafka.topic.neon.contacts}">
                <kafka:message>
                    <kafka:key><![CDATA[#[payload.sf_id default correlationId]]]></kafka:key>
                    <kafka:headers><![CDATA[#[{'X-Correlation-Id': correlationId}]]]></kafka:headers>
                </kafka:message>
            </kafka:publish>
            <logger level="INFO" message="Published pending contact to Kafka neon.contacts.pending | sf_id=#[payload.sf_id] | correlationId=#[correlationId]" />
        </foreach>
        <error-handler ref="Global_Error_Handler" />
    </flow>

    <!-- Poll DB for pending accounts -> Kafka topic orca.neon.accounts.pending -->
    <flow name="poll-neon-accounts-to-kafka-flow">
        <scheduler>
            <scheduling-strategy>
                <fixed-frequency frequency="\${poll.frequency.seconds}" timeUnit="SECONDS" />
            </scheduling-strategy>
        </scheduler>
        <logger level="DEBUG" message="Polling DB for pending accounts..." />
        <http:request config-ref="DB_System_API_Poll" method="GET" path="/api/accounts">
            <http:query-params><![CDATA[#[{"status": "pending"}]]]></http:query-params>
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
                    <ee:set-payload resource="dwl/db-account-to-canonical.dwl" />
                </ee:message>
            </ee:transform>
            <set-variable variableName="originalPayload" value="#[payload]" />
            <flow-ref name="encrypt-pii-account-subflow" />
            <kafka:publish config-ref="Kafka_Producer_Config" topic="\${kafka.topic.neon.accounts}">
                <kafka:message>
                    <kafka:key><![CDATA[#[payload.sf_id default correlationId]]]></kafka:key>
                    <kafka:headers><![CDATA[#[{'X-Correlation-Id': correlationId}]]]></kafka:headers>
                </kafka:message>
            </kafka:publish>
            <logger level="INFO" message="Published pending account to Kafka neon.accounts.pending | sf_id=#[payload.sf_id] | correlationId=#[correlationId]" />
        </foreach>
        <error-handler ref="Global_Error_Handler" />
    </flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/db-poll-to-kafka-flow.xml`);

  // Global config with Kafka producer + SF CDC + HTTP listener
  write(
    path.join(p, "src/main/mule/global-config.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:kafka="http://www.mulesoft.org/schema/mule/kafka"
      xmlns:salesforce="http://www.mulesoft.org/schema/mule/salesforce"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd
        http://www.mulesoft.org/schema/mule/kafka http://www.mulesoft.org/schema/mule/kafka/current/mule-kafka.xsd
        http://www.mulesoft.org/schema/mule/salesforce http://www.mulesoft.org/schema/mule/salesforce/current/mule-salesforce.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <configuration-properties file="config.properties" />

    <http:listener-config name="Sync_Process_API_HTTP_Listener">
        <http:listener-connection host="0.0.0.0" port="\${http.port}" />
    </http:listener-config>

    <salesforce:sfdc-config name="Salesforce_CDC_Config">
        <salesforce:basic-connection
            username="\${sf.username}"
            password="\${sf.password}"
            securityToken="\${sf.security.token}"
            url="\${sf.login.url}" />
    </salesforce:sfdc-config>

    <kafka:producer-config name="Kafka_Producer_Config">
        <kafka:producer-plaintext-connection>
            <kafka:bootstrap-servers>
                <kafka:bootstrap-server value="\${kafka.bootstrap.servers}" />
            </kafka:bootstrap-servers>
            <kafka:sasl-plain-auth username="\${kafka.api.key}" password="\${kafka.api.secret}" />
        </kafka:producer-plaintext-connection>
    </kafka:producer-config>

    <!-- Health check endpoint -->
    <flow name="get-sync-health-flow">
        <http:listener config-ref="Sync_Process_API_HTTP_Listener" path="/api/health" method="GET" />
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
    status: "UP",
    service: "sync-process-api",
    architecture: "Kafka event backbone",
    kafka_topics: {
        sfdc_contacts_cdc: "\${kafka.topic.sfdc.contacts}",
        sfdc_accounts_cdc: "\${kafka.topic.sfdc.accounts}",
        neon_contacts_pending: "\${kafka.topic.neon.contacts}",
        neon_accounts_pending: "\${kafka.topic.neon.accounts}",
        audit: "\${kafka.topic.audit}",
        dlq: "\${kafka.topic.dlq}"
    },
    poll_frequency: "\${poll.frequency.seconds}s"
}]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <!-- Audit event sub-flow: publishes to orca.audit.sync-events -->
    <sub-flow name="publish-audit-event-subflow">
        <ee:transform>
            <ee:message>
                <ee:set-payload resource="dwl/wrap-sync-event.dwl" />
            </ee:message>
        </ee:transform>
        <kafka:publish config-ref="Kafka_Producer_Config" topic="\${kafka.topic.audit}">
            <kafka:message>
                <kafka:key><![CDATA[#[payload.correlation_id default correlationId]]]></kafka:key>
            </kafka:message>
        </kafka:publish>
        <logger level="DEBUG" message="Audit event published to Kafka | correlationId=#[correlationId]" />
    </sub-flow>
</mule>
`
  );
  files.push(`${name}/src/main/mule/global-config.xml`);

  // Global error handler
  write(path.join(p, "src/main/mule/global-error-handler.xml"), globalErrorHandlerXml());
  files.push(`${name}/src/main/mule/global-error-handler.xml`);

  // Log4j2
  write(path.join(p, "src/main/resources/log4j2.xml"), log4j2Config(name));
  files.push(`${name}/src/main/resources/log4j2.xml`);

  // config.properties — now with Kafka
  write(
    path.join(p, "src/main/resources/config.properties"),
    `http.port=8081
sf.username=\${SF_USERNAME}
sf.password=\${SF_PASSWORD}
sf.security.token=\${SF_SECURITY_TOKEN}
sf.login.url=https://login.salesforce.com
sf.system.api.port=8082
db.system.api.port=8083
poll.frequency.seconds=15
kafka.bootstrap.servers=\${KAFKA_BOOTSTRAP_SERVERS}
kafka.api.key=\${KAFKA_API_KEY}
kafka.api.secret=\${KAFKA_API_SECRET}
kafka.topic.sfdc.contacts=orca.sfdc.contacts.cdc
kafka.topic.sfdc.accounts=orca.sfdc.accounts.cdc
kafka.topic.neon.contacts=orca.neon.contacts.pending
kafka.topic.neon.accounts=orca.neon.accounts.pending
kafka.topic.dlq=orca.dlq.sync-failures
kafka.topic.audit=orca.audit.sync-events
crypto.keystore.path=\${ORCA_CRYPTO_KEYSTORE_PATH}
crypto.keystore.password=\${ORCA_CRYPTO_KEYSTORE_PASSWORD}
crypto.key.alias=\${ORCA_CRYPTO_KEY_ALIAS}
`
  );
  files.push(`${name}/src/main/resources/config.properties`);

  // RAML
  write(
    path.join(p, "src/main/resources/api/sync-process-api.raml"),
    `#%RAML 1.0
title: Sync Process API
version: v1
baseUri: http://localhost:8081/api
description: |
  Orchestrates bidirectional sync between Salesforce and Neon PostgreSQL via Kafka.
  - SF -> Postgres: CDC events published to Kafka topics, consumed by db-system-api
  - Postgres -> SF: Scheduler polls pending rows, publishes to Kafka, consumed by sf-system-api
  - Audit events published to orca.audit.sync-events topic

/health:
  get:
    description: Returns sync process health, Kafka topic configuration, and architecture info
    responses:
      200:
        body:
          application/json:
            example: |
              {
                "status": "UP",
                "service": "sync-process-api",
                "architecture": "Kafka event backbone",
                "poll_frequency": "15s"
              }
`
  );
  files.push(`${name}/src/main/resources/api/sync-process-api.raml`);

  // pom.xml — Kafka connector added, objectstore retained for future use
  const syncDeps = `        <dependency>
            <groupId>com.mulesoft.connectors</groupId>
            <artifactId>mule-salesforce-connector</artifactId>
            <version>10.20.0</version>
            <classifier>mule-plugin</classifier>
        </dependency>
${kafkaConnectorDep}
${cryptoModuleDep}
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
    `# ${name}\n\nSync Process API — Orchestrates bidirectional sync between Salesforce and Neon PostgreSQL via Confluent Cloud Kafka.\n\nPart of the SF-Postgres Bidirectional Sync use case scaffolded by Orca.\n\n## Architecture (Kafka Event Backbone)\n\n- **SF -> Postgres**: Salesforce CDC events -> Kafka topics (\`orca.sfdc.contacts.cdc\`, \`orca.sfdc.accounts.cdc\`) -> db-system-api consumers\n- **Postgres -> SF**: Scheduler polls db-system-api for pending rows -> Kafka topics (\`orca.neon.contacts.pending\`, \`orca.neon.accounts.pending\`) -> sf-system-api consumers\n- **Audit**: All sync events published to \`orca.audit.sync-events\` -> persisted in \`sync_events\` table\n- **DLQ**: Failures routed to \`orca.dlq.sync-failures\`\n\n## Kafka Topics\n\n| Topic | Direction | Description |\n|-------|-----------|-------------|\n| \`orca.sfdc.contacts.cdc\` | SF -> PG | Contact CDC events |\n| \`orca.sfdc.accounts.cdc\` | SF -> PG | Account CDC events |\n| \`orca.neon.contacts.pending\` | PG -> SF | Pending contact changes |\n| \`orca.neon.accounts.pending\` | PG -> SF | Pending account changes |\n| \`orca.audit.sync-events\` | Both | Audit trail |\n| \`orca.dlq.sync-failures\` | Both | Dead letter queue |\n\n## Dependencies\n\n- sf-system-api (port 8082)\n- db-system-api (port 8083)\n- Confluent Cloud Kafka cluster\n\n## Port: 8081\n`
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
        data = resp.json()
        assert data.get("status") == "UP"
        assert data.get("architecture") == "Kafka event backbone"

class TestEndToEndSync:
    """Integration tests — requires all three APIs running"""

    def test_sf_api_reachable(self):
        resp = requests.get(f"{SF_URL}/api/health")
        assert resp.status_code == 200

    def test_db_api_reachable(self):
        resp = requests.get(f"{DB_URL}/api/health")
        assert resp.status_code == 200

    def test_db_sync_events_endpoint(self):
        resp = requests.get(f"{DB_URL}/api/sync-events")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
`
  );
  files.push(`${name}/tests/test_sync_process_api.py`);

  return files;
}

// ─── Main template ────────────────────────────────────────────────────────────

export const sfPostgresSyncTemplate: Template = {
  metadata: {
    id: "sf-postgres-sync",
    name: "Salesforce-Postgres Bidirectional Sync (Kafka)",
    description:
      "Three MuleSoft APIs with Confluent Cloud Kafka as the event backbone for real-time bidirectional sync between Salesforce Contacts/Accounts and Neon PostgreSQL. Includes canonical data model, structured logging, global error handling, and audit trail.",
    requiredCredentials: ["anypoint", "salesforce", "neon", "kafka"],
    ports: {
      "sync-process-api": 8081,
      "sf-system-api": 8082,
      "db-system-api": 8083,
    },
    projects: ["${projectName}-sync-process-api", "${projectName}-sf-system-api", "${projectName}-db-system-api", "${projectName}-common"],
    architecture: "CDC + Kafka + Polling",
  },

  async scaffold(basePath: string, projectName: string): Promise<ScaffoldResult> {
    const allFiles: string[] = [];

    allFiles.push(...scaffoldCanonicalModel(basePath, projectName));
    allFiles.push(...scaffoldConventions(basePath, projectName));
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
        `${projectName}-common`,
        `${projectName}-sync-process-api`,
        `${projectName}-sf-system-api`,
        `${projectName}-db-system-api`,
      ],
    };
  },
};
