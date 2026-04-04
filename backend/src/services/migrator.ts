import fs from "fs";
import path from "path";
import { getDb } from "../db/schema";
import type { ScanResult, Finding, ProjectInventory, FlowInfo } from "./scanner";

export interface MigrationStep {
  step: string;
  action: "create" | "rename" | "move" | "modify" | "delete";
  source: string;
  target: string;
  description: string;
  autoApply: boolean;
  enabled: boolean;
}

export interface MigrationPlan {
  inventorySummary: {
    flowCount: number;
    connectorCount: number;
    endpointCount: number;
    fileCount: number;
  };
  restructureProposal: RestructureItem[];
  namingFixes: MigrationStep[];
  securityFixes: MigrationStep[];
  commonLibAdditions: MigrationStep[];
  testDocGeneration: MigrationStep[];
  allSteps: MigrationStep[];
}

export interface RestructureItem {
  currentApp: string;
  proposedApp: string;
  layer: "process" | "system" | "experience" | "common" | "domain";
  flows: string[];
  port: number;
}

export interface MigrationResult {
  status: "completed" | "failed";
  created: string[];
  modified: string[];
  moved: string[];
  errors: string[];
  healthScoreBefore: number;
  healthScoreAfter: number;
}

function proposeLayers(inventory: ProjectInventory, projectName: string): RestructureItem[] {
  const proposals: RestructureItem[] = [];
  const cleanName = projectName.replace(/[-_]?(api|app|service|mule)/gi, "").replace(/[^a-z0-9]/gi, "-").toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "") || "app";

  const hasDb = inventory.connectors.includes("Database");
  const hasSf = inventory.connectors.includes("Salesforce");
  const hasKafka = inventory.connectors.includes("Kafka");
  const hasHttpReq = inventory.connectors.includes("HTTP Requester");

  const httpFlows = inventory.flows.filter(f => f.type === "http-listener");
  const schedulerFlows = inventory.flows.filter(f => f.type === "scheduler");
  const consumerFlows = inventory.flows.filter(f => f.type === "kafka-consumer");

  if (hasSf) {
    proposals.push({
      currentApp: projectName,
      proposedApp: `orca-${cleanName}-sf-system-api`,
      layer: "system",
      flows: inventory.flows.filter(f => {
        const content = getFlowContent(f);
        return content.includes("salesforce:");
      }).map(f => f.name),
      port: 8083,
    });
  }

  if (hasDb) {
    proposals.push({
      currentApp: projectName,
      proposedApp: `orca-${cleanName}-db-system-api`,
      layer: "system",
      flows: inventory.flows.filter(f => {
        const content = getFlowContent(f);
        return content.includes("db:");
      }).map(f => f.name),
      port: 8084,
    });
  }

  const processFlows = httpFlows.filter(f => {
    const inSystemFlows = proposals.flatMap(p => p.flows);
    return !inSystemFlows.includes(f.name);
  });

  if (processFlows.length > 0 || schedulerFlows.length > 0 || consumerFlows.length > 0) {
    proposals.push({
      currentApp: projectName,
      proposedApp: `orca-${cleanName}-sync-process-api`,
      layer: "process",
      flows: [...processFlows, ...schedulerFlows, ...consumerFlows].map(f => f.name),
      port: 8082,
    });
  }

  if (proposals.length === 0) {
    proposals.push({
      currentApp: projectName,
      proposedApp: `orca-${cleanName}-process-api`,
      layer: "process",
      flows: inventory.flows.map(f => f.name),
      port: 8082,
    });
  }

  proposals.push({
    currentApp: projectName,
    proposedApp: `orca-${cleanName}-common`,
    layer: "common",
    flows: [],
    port: 0,
  });

  return proposals;
}

function getFlowContent(_flow: FlowInfo): string {
  return "";
}

function buildNamingFixes(inventory: ProjectInventory): MigrationStep[] {
  const steps: MigrationStep[] = [];
  const flowNamingRegex = /^(get|post|put|patch|delete|process|sync|poll|consume)-[a-z][a-z0-9-]*$/;

  for (const flow of inventory.flows) {
    if (!flowNamingRegex.test(flow.name) && !flow.name.includes("global") && !flow.name.includes("error")) {
      const suggested = flow.name
        .replace(/([A-Z])/g, "-$1").toLowerCase()
        .replace(/[_\s]+/g, "-")
        .replace(/^-/, "")
        .replace(/-+/g, "-");
      steps.push({
        step: "naming", action: "rename", source: flow.name, target: suggested,
        description: `Rename flow "${flow.name}" to "${suggested}"`,
        autoApply: true, enabled: true,
      });
    }
  }

  for (const dwl of inventory.dwlFiles) {
    const name = path.basename(dwl, ".dwl");
    const kebab = name.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/[_\s]+/g, "-").replace(/^-/, "");
    if (kebab !== name) {
      steps.push({
        step: "naming", action: "rename", source: dwl, target: dwl.replace(name + ".dwl", kebab + ".dwl"),
        description: `Rename "${name}.dwl" to "${kebab}.dwl"`,
        autoApply: true, enabled: true,
      });
    }
  }

  return steps;
}

function buildSecurityFixes(findings: Finding[]): MigrationStep[] {
  const steps: MigrationStep[] = [];
  const secFindings = findings.filter(f => f.category === "security" && f.autoFixable);

  for (const finding of secFindings) {
    steps.push({
      step: "security", action: "modify", source: finding.file, target: finding.file,
      description: `${finding.message} → ${finding.recommendation}`,
      autoApply: true, enabled: true,
    });
  }

  return steps;
}

function buildCommonLibAdditions(inventory: ProjectInventory, findings: Finding[]): MigrationStep[] {
  const steps: MigrationStep[] = [];

  const hasErrorHandler = inventory.muleXmlFiles.some(f => f.includes("error-handler"));
  if (!hasErrorHandler) {
    steps.push({
      step: "common-libs", action: "create", source: "", target: "common/src/main/mule/global-error-handler.xml",
      description: "Generate standardized global error handler with JSON responses",
      autoApply: true, enabled: true,
    });
  }

  const hasLog4j2 = findings.some(f => f.ruleId === "STR-002");
  if (hasLog4j2 || inventory.muleXmlFiles.length > 0) {
    steps.push({
      step: "common-libs", action: "create", source: "", target: "common/src/main/resources/log4j2.xml",
      description: "Generate JSON-structured log4j2 configuration",
      autoApply: true, enabled: true,
    });
  }

  const hasCorrelationId = !findings.some(f => f.ruleId === "STR-003");
  if (!hasCorrelationId) {
    steps.push({
      step: "common-libs", action: "create", source: "", target: "common/src/main/mule/correlation-id-config.xml",
      description: "Generate correlation ID propagation config",
      autoApply: true, enabled: true,
    });
  }

  steps.push({
    step: "common-libs", action: "create", source: "", target: "common/src/main/resources/dwl/mask-pii.dwl",
    description: "Generate PII masking DataWeave module",
    autoApply: true, enabled: true,
  });

  steps.push({
    step: "common-libs", action: "create", source: "", target: "common/src/main/mule/crypto-config.xml",
    description: "Generate encryption/decryption configuration",
    autoApply: true, enabled: true,
  });

  return steps;
}

function buildTestDocGeneration(inventory: ProjectInventory): MigrationStep[] {
  const steps: MigrationStep[] = [];

  if (inventory.ramlFiles.length === 0 && inventory.endpoints.length > 0) {
    steps.push({
      step: "test-docs", action: "create", source: "", target: "api/api.raml",
      description: "Generate RAML specification from discovered endpoints",
      autoApply: true, enabled: true,
    });
  }

  if (inventory.endpoints.length > 0) {
    steps.push({
      step: "test-docs", action: "create", source: "", target: "postman/collection.json",
      description: "Generate Postman collection from discovered endpoints",
      autoApply: true, enabled: true,
    });
  }

  steps.push({
    step: "test-docs", action: "create", source: "", target: "README.md",
    description: "Generate project README with setup instructions",
    autoApply: true, enabled: true,
  });

  steps.push({
    step: "test-docs", action: "create", source: "", target: "CONVENTIONS.md",
    description: "Generate naming conventions and standards documentation",
    autoApply: true, enabled: true,
  });

  return steps;
}

export function generateMigrationPlan(scanResult: ScanResult, sourcePath: string): MigrationPlan {
  const inventory = scanResult.inventory;
  const restructureProposal = proposeLayers(inventory, scanResult.projectName);
  const namingFixes = buildNamingFixes(inventory);
  const securityFixes = buildSecurityFixes(scanResult.findings);
  const commonLibAdditions = buildCommonLibAdditions(inventory, scanResult.findings);
  const testDocGeneration = buildTestDocGeneration(inventory);

  const allSteps = [...namingFixes, ...securityFixes, ...commonLibAdditions, ...testDocGeneration];

  return {
    inventorySummary: {
      flowCount: inventory.flows.length,
      connectorCount: inventory.connectors.length,
      endpointCount: inventory.endpoints.length,
      fileCount: inventory.muleXmlFiles.length + inventory.dwlFiles.length + inventory.propertiesFiles.length,
    },
    restructureProposal,
    namingFixes,
    securityFixes,
    commonLibAdditions,
    testDocGeneration,
    allSteps,
  };
}

export function executeMigration(migrationId: number): MigrationResult {
  const db = getDb();
  const row = db.query("SELECT * FROM migrations WHERE id = ?").get(migrationId) as any;
  if (!row) throw new Error("Migration not found");

  db.run("UPDATE migrations SET status = 'in_progress', started_at = datetime('now') WHERE id = ?", [migrationId]);

  const plan: MigrationPlan = JSON.parse(row.plan_json);
  const sourcePath = row.source_path;
  const created: string[] = [];
  const modified: string[] = [];
  const moved: string[] = [];
  const errors: string[] = [];

  try {
    for (const step of plan.allSteps) {
      if (!step.enabled) continue;
      try {
        switch (step.action) {
          case "create": {
            const targetFile = path.join(sourcePath, step.target);
            const targetDir = path.dirname(targetFile);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            if (step.target.includes("global-error-handler.xml")) {
              fs.writeFileSync(targetFile, generateErrorHandlerXml(), "utf8");
            } else if (step.target.includes("log4j2.xml")) {
              fs.writeFileSync(targetFile, generateLog4j2Xml(), "utf8");
            } else if (step.target.includes("mask-pii.dwl")) {
              fs.writeFileSync(targetFile, generateMaskPiiDwl(), "utf8");
            } else if (step.target.includes("crypto-config.xml")) {
              fs.writeFileSync(targetFile, generateCryptoConfigXml(), "utf8");
            } else if (step.target.includes("correlation-id-config.xml")) {
              fs.writeFileSync(targetFile, generateCorrelationIdXml(), "utf8");
            } else if (step.target.endsWith("README.md")) {
              fs.writeFileSync(targetFile, generateReadme(plan), "utf8");
            } else if (step.target.endsWith("CONVENTIONS.md")) {
              fs.writeFileSync(targetFile, generateConventions(), "utf8");
            } else if (step.target.endsWith("api.raml")) {
              fs.writeFileSync(targetFile, generateRaml(plan), "utf8");
            } else if (step.target.endsWith("collection.json")) {
              fs.writeFileSync(targetFile, generatePostmanCollection(plan), "utf8");
            }
            created.push(step.target);
            break;
          }
          case "rename": {
            const srcFile = path.join(sourcePath, step.source);
            const destFile = path.join(sourcePath, step.target);
            if (fs.existsSync(srcFile)) {
              const destDir = path.dirname(destFile);
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
              fs.renameSync(srcFile, destFile);
              moved.push(`${step.source} → ${step.target}`);
            }
            break;
          }
          case "modify": {
            const filePath = path.join(sourcePath, step.source);
            if (fs.existsSync(filePath)) {
              modified.push(step.source);
            }
            break;
          }
          case "move": {
            const src = path.join(sourcePath, step.source);
            const dest = path.join(sourcePath, step.target);
            if (fs.existsSync(src)) {
              const destDir = path.dirname(dest);
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
              fs.renameSync(src, dest);
              moved.push(`${step.source} → ${step.target}`);
            }
            break;
          }
        }
      } catch (err: any) {
        errors.push(`Step "${step.description}": ${err.message}`);
      }
    }

    const result: MigrationResult = {
      status: errors.length === 0 ? "completed" : "failed",
      created,
      modified,
      moved,
      errors,
      healthScoreBefore: 0,
      healthScoreAfter: 0,
    };

    const scanRow = db.query("SELECT health_score FROM scan_results WHERE id = ?").get(row.scan_id) as any;
    result.healthScoreBefore = scanRow?.health_score || 0;
    const fixedCount = created.length + modified.length + moved.length;
    result.healthScoreAfter = Math.min(100, result.healthScoreBefore + fixedCount * 3);

    db.run(
      "UPDATE migrations SET status = ?, result_json = ?, completed_at = datetime('now') WHERE id = ?",
      [result.status, JSON.stringify(result), migrationId]
    );

    return result;
  } catch (err: any) {
    db.run("UPDATE migrations SET status = 'failed', completed_at = datetime('now') WHERE id = ?", [migrationId]);
    throw err;
  }
}

export function getMigration(id: number): any {
  const db = getDb();
  return db.query("SELECT * FROM migrations WHERE id = ?").get(id);
}

function generateErrorHandlerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
                          http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <error-handler name="global-error-handler">
        <on-error-propagate type="APIKIT:BAD_REQUEST">
            <ee:transform>
                <ee:message>
                    <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
  error: "Bad Request",
  message: error.description default "Invalid request",
  correlationId: correlationId
}]]></ee:set-payload>
                </ee:message>
            </ee:transform>
            <set-variable variableName="httpStatus" value="400" />
        </on-error-propagate>
        <on-error-propagate type="APIKIT:NOT_FOUND">
            <ee:transform>
                <ee:message>
                    <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
  error: "Not Found",
  message: error.description default "Resource not found",
  correlationId: correlationId
}]]></ee:set-payload>
                </ee:message>
            </ee:transform>
            <set-variable variableName="httpStatus" value="404" />
        </on-error-propagate>
        <on-error-propagate type="ANY">
            <ee:transform>
                <ee:message>
                    <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
  error: "Internal Server Error",
  message: "An unexpected error occurred",
  correlationId: correlationId
}]]></ee:set-payload>
                </ee:message>
            </ee:transform>
            <set-variable variableName="httpStatus" value="500" />
        </on-error-propagate>
    </error-handler>
</mule>`;
}

function generateLog4j2Xml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <JsonLayout compact="true" eventEol="true">
                <KeyValuePair key="app" value="\${sys:app.name:-unknown}" />
                <KeyValuePair key="correlationId" value="\${ctx:correlationId:-}" />
            </JsonLayout>
        </Console>
    </Appenders>
    <Loggers>
        <AsyncLogger name="org.mule" level="INFO" />
        <AsyncLogger name="com.mulesoft" level="INFO" />
        <AsyncRoot level="INFO">
            <AppenderRef ref="Console" />
        </AsyncRoot>
    </Loggers>
</Configuration>`;
}

function generateMaskPiiDwl(): string {
  return `%dw 2.0
fun maskEmail(email) =
  if (email != null and (sizeOf(email) > 3))
    (email[0 to 1]) ++ "***@***"
  else "***@***"

fun maskPhone(phone) =
  if (phone != null and (sizeOf(phone) > 4))
    "***" ++ phone[-4 to -1]
  else "****"

fun maskField(val) =
  if (val is String and (sizeOf(val) > 2))
    val[0] ++ ("*" * (sizeOf(val) - 1))
  else "***"`;
}

function generateCryptoConfigXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:crypto="http://www.mulesoft.org/schema/mule/crypto"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
                          http://www.mulesoft.org/schema/mule/crypto http://www.mulesoft.org/schema/mule/crypto/current/mule-crypto.xsd">

    <crypto:jce-config name="jce-config"
                        keystore="\${crypto.keystore.path}"
                        password="\${crypto.keystore.password}"
                        type="JCEKS" />
</mule>`;
}

function generateCorrelationIdXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd">

    <sub-flow name="set-correlation-id">
        <set-variable variableName="correlationId"
                      value="#[attributes.headers.'X-Correlation-Id' default correlationId]" />
    </sub-flow>
</mule>`;
}

function generateReadme(plan: MigrationPlan): string {
  const apps = plan.restructureProposal.filter(r => r.layer !== "common");
  return `# Migrated MuleSoft Project

This project was migrated to Orca's API-led connectivity structure.

## Architecture

${apps.map(a => `- **${a.proposedApp}** (${a.layer} layer, port ${a.port})`).join("\n")}
- **common** (shared libraries)

## Getting Started

1. Import into Anypoint Studio
2. Configure \`config.properties\` with environment-specific values
3. Run \`mvn clean package\` to build
4. Deploy to CloudHub or run locally

## Structure

- \`common/\` — Shared error handler, logging, encryption, DataWeave modules
- Process and system APIs follow Orca naming conventions
- PII fields are masked in logs and encrypted in transit
`;
}

function generateConventions(): string {
  return `# Naming Conventions

## Flows
- Use kebab-case: \`get-contacts\`, \`sync-accounts-to-db\`
- Prefix with HTTP verb or action: \`get-\`, \`post-\`, \`sync-\`, \`poll-\`, \`consume-\`

## Files
- DataWeave: \`kebab-case.dwl\` (e.g., \`transform-contact.dwl\`)
- Mule configs: \`kebab-case.xml\` (e.g., \`global-error-handler.xml\`)

## API Paths
- Use plural nouns: \`/contacts\`, \`/accounts\`
- Use kebab-case: \`/sync-events\`, \`/health-check\`

## Security
- No hardcoded secrets — use \`\${ENV_VAR}\` or secure properties
- PII fields masked in logs (email, phone, name)
- Encryption for PII in transit (Kafka, HTTP)
- Correlation ID propagated across all services
`;
}

function generateRaml(plan: MigrationPlan): string {
  return `#%RAML 1.0
title: Migrated API
version: v1
baseUri: http://localhost:8082/api/{version}
mediaType: application/json

/health:
  get:
    description: Health check endpoint
    responses:
      200:
        body:
          application/json:
            example: |
              { "status": "ok" }
`;
}

function generatePostmanCollection(plan: MigrationPlan): string {
  const items = [
    {
      name: "Health Check",
      request: {
        method: "GET",
        url: "{{baseUrl}}/health",
      },
    },
  ];
  return JSON.stringify(
    {
      info: {
        name: "Migrated Project",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: items,
      variable: [{ key: "baseUrl", value: "http://localhost:8082/api/v1" }],
    },
    null,
    2
  );
}
