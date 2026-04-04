import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { getDb } from "../db/schema";

export type Severity = "critical" | "warning" | "info";
export type Category = "security" | "naming" | "structure" | "best-practice";

export interface Finding {
  severity: Severity;
  category: Category;
  ruleId: string;
  file: string;
  line: number;
  message: string;
  recommendation: string;
  autoFixable: boolean;
}

export interface ScanResult {
  projectName: string;
  sourceUrl: string | null;
  findings: Finding[];
  healthScore: number;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  migrationReady: boolean;
  inventory: ProjectInventory;
}

export interface ProjectInventory {
  muleXmlFiles: string[];
  propertiesFiles: string[];
  dwlFiles: string[];
  ramlFiles: string[];
  pomFiles: string[];
  flows: FlowInfo[];
  connectors: string[];
  endpoints: EndpointInfo[];
  dependencies: string[];
}

export interface FlowInfo {
  name: string;
  file: string;
  type: "http-listener" | "scheduler" | "kafka-consumer" | "other";
  lineCount: number;
}

export interface EndpointInfo {
  path: string;
  method: string;
  file: string;
}

export interface RuleDefinition {
  id: string;
  category: Category;
  severity: Severity;
  name: string;
  description: string;
  autoFixable: boolean;
}

export const RULES: RuleDefinition[] = [
  // Security rules
  { id: "SEC-001", category: "security", severity: "critical", name: "Hardcoded credentials", description: "Checks for hardcoded passwords, tokens, or keys in Mule XML", autoFixable: true },
  { id: "SEC-002", category: "security", severity: "critical", name: "Plain-text secrets in properties", description: "Properties files contain secrets not using ${ENV_VAR} pattern", autoFixable: true },
  { id: "SEC-003", category: "security", severity: "warning", name: "HTTP instead of HTTPS", description: "HTTP listener or requester not using HTTPS/TLS", autoFixable: false },
  { id: "SEC-004", category: "security", severity: "warning", name: "No error handler on flow", description: "Flows without error handling will expose stack traces", autoFixable: true },
  { id: "SEC-005", category: "security", severity: "warning", name: "PII in logger messages", description: "Logger messages reference PII fields directly", autoFixable: true },
  // Naming rules
  { id: "NAM-001", category: "naming", severity: "warning", name: "Flow naming convention", description: "Flow names should follow kebab-case with layer prefix", autoFixable: true },
  { id: "NAM-002", category: "naming", severity: "info", name: "Config reference naming", description: "Config references should use descriptive names", autoFixable: true },
  { id: "NAM-003", category: "naming", severity: "info", name: "DataWeave file naming", description: "DWL files should use kebab-case naming", autoFixable: true },
  { id: "NAM-004", category: "naming", severity: "warning", name: "API path conventions", description: "API paths should use plural nouns and kebab-case", autoFixable: false },
  // Structure rules
  { id: "STR-001", category: "structure", severity: "warning", name: "Missing global error handler", description: "No global-error-handler.xml found", autoFixable: true },
  { id: "STR-002", category: "structure", severity: "warning", name: "Default log4j2 config", description: "Using default or missing log4j2.xml — should use JSON layout", autoFixable: true },
  { id: "STR-003", category: "structure", severity: "info", name: "No correlation ID", description: "No correlation ID propagation detected", autoFixable: true },
  { id: "STR-004", category: "structure", severity: "warning", name: "Missing RAML specification", description: "No RAML API specification found", autoFixable: false },
  { id: "STR-005", category: "structure", severity: "warning", name: "Oversized flow", description: "Flow exceeds 200 lines — consider splitting", autoFixable: false },
  // Best practice rules
  { id: "BP-001", category: "best-practice", severity: "info", name: "No API-led connectivity", description: "Project doesn't follow API-led connectivity pattern (experience/process/system)", autoFixable: false },
  { id: "BP-002", category: "best-practice", severity: "warning", name: "Direct DB calls in process layer", description: "Process API should delegate DB access to system API", autoFixable: false },
  { id: "BP-003", category: "best-practice", severity: "info", name: "Missing health endpoint", description: "No /health or /ping endpoint found", autoFixable: true },
  { id: "BP-004", category: "best-practice", severity: "info", name: "No test files", description: "No MUnit test files or test directories found", autoFixable: false },
];

const SECRET_PATTERNS = [
  /password\s*=\s*"[^$][^"]*"/i,
  /secret\s*=\s*"[^$][^"]*"/i,
  /token\s*=\s*"[^$][^"]*"/i,
  /apiKey\s*=\s*"[^$][^"]*"/i,
  /client_secret\s*=\s*"[^$][^"]*"/i,
];

const PROP_SECRET_KEYS = ["password", "secret", "token", "apikey", "api_key", "client_secret", "security_token"];

const PII_FIELDS = ["email", "phone", "firstName", "lastName", "first_name", "last_name", "ssn", "socialSecurity", "dateOfBirth"];

function collectFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target") continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(ext)) results.push(full);
    }
  };
  walk(dir);
  return results;
}

function collectByNames(dir: string, names: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "target") continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (names.includes(entry.name)) results.push(full);
    }
  };
  walk(dir);
  return results;
}

function relPath(base: string, file: string): string {
  return path.relative(base, file);
}

function buildInventory(projectPath: string): ProjectInventory {
  const muleXmlFiles = collectFiles(projectPath, ".xml").filter(f => {
    const content = fs.readFileSync(f, "utf8");
    return content.includes("http://www.mulesoft.org/schema/mule/") || content.includes("mule-artifact.json") || content.includes("<mule ");
  });
  const propertiesFiles = collectFiles(projectPath, ".properties");
  const dwlFiles = collectFiles(projectPath, ".dwl");
  const ramlFiles = [...collectFiles(projectPath, ".raml"), ...collectFiles(projectPath, ".yaml").filter(f => fs.readFileSync(f, "utf8").includes("#%RAML"))];
  const pomFiles = collectByNames(projectPath, ["pom.xml"]);

  const flows: FlowInfo[] = [];
  const connectors = new Set<string>();
  const endpoints: EndpointInfo[] = [];
  const dependencies: string[] = [];

  for (const xmlFile of muleXmlFiles) {
    const content = fs.readFileSync(xmlFile, "utf8");
    const lines = content.split("\n");

    const flowRegex = /<flow\s+name="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = flowRegex.exec(content)) !== null) {
      const flowName = match[1];
      const lineNum = content.substring(0, match.index).split("\n").length;
      const flowEndIdx = content.indexOf("</flow>", match.index);
      const flowContent = content.substring(match.index, flowEndIdx > 0 ? flowEndIdx : undefined);
      const flowLineCount = flowContent.split("\n").length;

      let type: FlowInfo["type"] = "other";
      if (flowContent.includes("http:listener")) type = "http-listener";
      else if (flowContent.includes("<scheduler")) type = "scheduler";
      else if (flowContent.includes("kafka:consumer") || flowContent.includes("kafka:message-listener")) type = "kafka-consumer";

      flows.push({ name: flowName, file: relPath(projectPath, xmlFile), type, lineCount: flowLineCount });

      const listenerMatch = flowContent.match(/path="([^"]+)"/);
      const methodMatch = flowContent.match(/method="([^"]+)"/i) || flowContent.match(/allowedMethods="([^"]+)"/i);
      if (type === "http-listener" && listenerMatch) {
        endpoints.push({
          path: listenerMatch[1],
          method: methodMatch?.[1] || "GET",
          file: relPath(projectPath, xmlFile),
        });
      }
    }

    const connectorPatterns = [
      { pattern: /salesforce:/, name: "Salesforce" },
      { pattern: /db:/, name: "Database" },
      { pattern: /http:request/, name: "HTTP Requester" },
      { pattern: /kafka:/, name: "Kafka" },
      { pattern: /jms:/, name: "JMS" },
      { pattern: /file:/, name: "File" },
      { pattern: /ftp:/, name: "FTP" },
      { pattern: /email:/, name: "Email" },
      { pattern: /vm:/, name: "VM" },
    ];
    for (const { pattern, name } of connectorPatterns) {
      if (pattern.test(content)) connectors.add(name);
    }
  }

  for (const pomFile of pomFiles) {
    const pomContent = fs.readFileSync(pomFile, "utf8");
    const depRegex = /<artifactId>([^<]+)<\/artifactId>/g;
    let depMatch: RegExpExecArray | null;
    while ((depMatch = depRegex.exec(pomContent)) !== null) {
      if (!dependencies.includes(depMatch[1])) dependencies.push(depMatch[1]);
    }
  }

  return {
    muleXmlFiles: muleXmlFiles.map(f => relPath(projectPath, f)),
    propertiesFiles: propertiesFiles.map(f => relPath(projectPath, f)),
    dwlFiles: dwlFiles.map(f => relPath(projectPath, f)),
    ramlFiles: ramlFiles.map(f => relPath(projectPath, f)),
    pomFiles: pomFiles.map(f => relPath(projectPath, f)),
    flows,
    connectors: [...connectors],
    endpoints,
    dependencies,
  };
}

function runSecurityRules(projectPath: string, inventory: ProjectInventory): Finding[] {
  const findings: Finding[] = [];

  for (const xmlRel of inventory.muleXmlFiles) {
    const xmlFile = path.join(projectPath, xmlRel);
    const content = fs.readFileSync(xmlFile, "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(lines[i])) {
          findings.push({
            severity: "critical", category: "security", ruleId: "SEC-001",
            file: xmlRel, line: i + 1,
            message: `Hardcoded credential found in XML`,
            recommendation: "Move to config.properties using \${secure::key} or environment variables",
            autoFixable: true,
          });
        }
      }
    }

    if (content.includes("http:listener-config") && !content.includes("tls:context") && !content.includes("protocol=\"HTTPS\"")) {
      findings.push({
        severity: "warning", category: "security", ruleId: "SEC-003",
        file: xmlRel, line: 1,
        message: "HTTP listener without TLS/HTTPS configuration",
        recommendation: "Add tls:context for production deployments",
        autoFixable: false,
      });
    }

    for (const flow of inventory.flows.filter(f => f.file === xmlRel)) {
      const flowStart = content.indexOf(`name="${flow.name}"`);
      if (flowStart < 0) continue;
      const flowSection = content.substring(flowStart, content.indexOf("</flow>", flowStart) + 7);
      if (!flowSection.includes("error-handler") && !flowSection.includes("on-error")) {
        const lineNum = content.substring(0, flowStart).split("\n").length;
        findings.push({
          severity: "warning", category: "security", ruleId: "SEC-004",
          file: xmlRel, line: lineNum,
          message: `Flow "${flow.name}" has no error handler`,
          recommendation: "Add <error-handler> with <on-error-propagate> or reference global error handler",
          autoFixable: true,
        });
      }
    }

    const loggerRegex = /<logger[^>]*message="([^"]*)"[^>]*\/>/g;
    let logMatch: RegExpExecArray | null;
    while ((logMatch = loggerRegex.exec(content)) !== null) {
      const msg = logMatch[1];
      for (const field of PII_FIELDS) {
        if (msg.toLowerCase().includes(field.toLowerCase()) || msg.includes(`payload.${field}`)) {
          const lineNum = content.substring(0, logMatch.index).split("\n").length;
          findings.push({
            severity: "warning", category: "security", ruleId: "SEC-005",
            file: xmlRel, line: lineNum,
            message: `Logger references PII field "${field}"`,
            recommendation: "Use masked logging or reference only non-PII identifiers (e.g., sf_id)",
            autoFixable: true,
          });
          break;
        }
      }
    }
  }

  for (const propRel of inventory.propertiesFiles) {
    const propFile = path.join(projectPath, propRel);
    const content = fs.readFileSync(propFile, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#") || !line.includes("=")) continue;
      const [key, ...rest] = line.split("=");
      const value = rest.join("=").trim();
      const keyLower = key.trim().toLowerCase();
      if (PROP_SECRET_KEYS.some(sk => keyLower.includes(sk)) && value && !value.startsWith("${") && !value.startsWith("!")) {
        findings.push({
          severity: "critical", category: "security", ruleId: "SEC-002",
          file: propRel, line: i + 1,
          message: `Plain-text secret "${key.trim()}" in properties file`,
          recommendation: "Replace with ${ENV_VAR} or use secure properties module",
          autoFixable: true,
        });
      }
    }
  }

  return findings;
}

function runNamingRules(projectPath: string, inventory: ProjectInventory): Finding[] {
  const findings: Finding[] = [];
  const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  const flowNamingRegex = /^(get|post|put|patch|delete|process|sync|poll|consume)-[a-z][a-z0-9-]*$/;

  for (const flow of inventory.flows) {
    if (!flowNamingRegex.test(flow.name) && !flow.name.includes("global") && !flow.name.includes("error")) {
      findings.push({
        severity: "warning", category: "naming", ruleId: "NAM-001",
        file: flow.file, line: 1,
        message: `Flow "${flow.name}" doesn't follow naming convention (verb-resource-pattern)`,
        recommendation: "Use pattern like: get-contacts, post-account, sync-contacts-to-db",
        autoFixable: true,
      });
    }
  }

  for (const dwl of inventory.dwlFiles) {
    const name = path.basename(dwl, ".dwl");
    if (!kebabCase.test(name)) {
      findings.push({
        severity: "info", category: "naming", ruleId: "NAM-003",
        file: dwl, line: 1,
        message: `DataWeave file "${name}.dwl" doesn't use kebab-case`,
        recommendation: "Rename to kebab-case (e.g., transform-contact.dwl)",
        autoFixable: true,
      });
    }
  }

  for (const ep of inventory.endpoints) {
    const segments = ep.path.split("/").filter(Boolean);
    for (const seg of segments) {
      if (seg.startsWith("{")) continue;
      if (seg !== seg.toLowerCase() || seg.includes("_")) {
        findings.push({
          severity: "warning", category: "naming", ruleId: "NAM-004",
          file: ep.file, line: 1,
          message: `API path "${ep.path}" uses non-standard segment "${seg}"`,
          recommendation: "Use lowercase kebab-case for path segments (e.g., /api/v1/sync-events)",
          autoFixable: false,
        });
        break;
      }
    }
  }

  return findings;
}

function runStructureRules(projectPath: string, inventory: ProjectInventory): Finding[] {
  const findings: Finding[] = [];

  const hasGlobalErrorHandler = inventory.muleXmlFiles.some(f =>
    f.includes("global-error-handler") || f.includes("error-handler")
  );
  if (!hasGlobalErrorHandler && inventory.muleXmlFiles.length > 0) {
    findings.push({
      severity: "warning", category: "structure", ruleId: "STR-001",
      file: "project", line: 0,
      message: "No global error handler XML found",
      recommendation: "Create global-error-handler.xml with standardized error responses",
      autoFixable: true,
    });
  }

  const log4j2Files = collectByNames(projectPath, ["log4j2.xml", "log4j2-test.xml"]);
  if (log4j2Files.length === 0) {
    findings.push({
      severity: "warning", category: "structure", ruleId: "STR-002",
      file: "project", line: 0,
      message: "No custom log4j2.xml found",
      recommendation: "Add log4j2.xml with JSON layout for structured logging",
      autoFixable: true,
    });
  } else {
    for (const lf of log4j2Files) {
      const content = fs.readFileSync(lf, "utf8");
      if (!content.includes("JsonLayout") && !content.includes("json") && !content.includes("JSON")) {
        findings.push({
          severity: "warning", category: "structure", ruleId: "STR-002",
          file: relPath(projectPath, lf), line: 1,
          message: "log4j2.xml doesn't use JSON layout",
          recommendation: "Switch to JsonLayout for structured log aggregation",
          autoFixable: true,
        });
      }
    }
  }

  const allContent = inventory.muleXmlFiles.map(f => fs.readFileSync(path.join(projectPath, f), "utf8")).join(" ");
  if (!allContent.includes("correlationId") && !allContent.includes("correlation-id") && !allContent.includes("X-Correlation-Id")) {
    findings.push({
      severity: "info", category: "structure", ruleId: "STR-003",
      file: "project", line: 0,
      message: "No correlation ID propagation detected",
      recommendation: "Add X-Correlation-Id header propagation across all flows",
      autoFixable: true,
    });
  }

  if (inventory.ramlFiles.length === 0 && inventory.endpoints.length > 0) {
    findings.push({
      severity: "warning", category: "structure", ruleId: "STR-004",
      file: "project", line: 0,
      message: "No RAML API specification found for exposed endpoints",
      recommendation: "Define API specification using RAML for design-first approach",
      autoFixable: false,
    });
  }

  for (const flow of inventory.flows) {
    if (flow.lineCount > 200) {
      findings.push({
        severity: "warning", category: "structure", ruleId: "STR-005",
        file: flow.file, line: 1,
        message: `Flow "${flow.name}" is ${flow.lineCount} lines — exceeds 200 line limit`,
        recommendation: "Split into sub-flows or extract reusable components",
        autoFixable: false,
      });
    }
  }

  return findings;
}

function runBestPracticeRules(projectPath: string, inventory: ProjectInventory): Finding[] {
  const findings: Finding[] = [];

  const hasProcessLayer = inventory.flows.some(f => f.name.includes("process") || f.file.includes("process"));
  const hasSystemLayer = inventory.flows.some(f => f.name.includes("system") || f.file.includes("system"));
  if (!hasProcessLayer && !hasSystemLayer && inventory.flows.length > 3) {
    findings.push({
      severity: "info", category: "best-practice", ruleId: "BP-001",
      file: "project", line: 0,
      message: "Project doesn't follow API-led connectivity pattern",
      recommendation: "Consider splitting into experience, process, and system API layers",
      autoFixable: false,
    });
  }

  const processFiles = inventory.muleXmlFiles.filter(f => f.includes("process"));
  for (const pf of processFiles) {
    const content = fs.readFileSync(path.join(projectPath, pf), "utf8");
    if (content.includes("db:select") || content.includes("db:insert") || content.includes("db:update")) {
      findings.push({
        severity: "warning", category: "best-practice", ruleId: "BP-002",
        file: pf, line: 1,
        message: "Direct database operations in process layer",
        recommendation: "Move DB operations to system API; process API should call system API via HTTP",
        autoFixable: false,
      });
    }
  }

  const hasHealthEndpoint = inventory.endpoints.some(e =>
    e.path.includes("health") || e.path.includes("ping") || e.path.includes("status")
  );
  if (!hasHealthEndpoint && inventory.endpoints.length > 0) {
    findings.push({
      severity: "info", category: "best-practice", ruleId: "BP-003",
      file: "project", line: 0,
      message: "No health/ping endpoint found",
      recommendation: "Add GET /health endpoint for monitoring and load balancer checks",
      autoFixable: true,
    });
  }

  const testFiles = collectFiles(projectPath, ".xml").filter(f => f.includes("test") || f.includes("Test") || f.includes("munit"));
  if (testFiles.length === 0) {
    findings.push({
      severity: "info", category: "best-practice", ruleId: "BP-004",
      file: "project", line: 0,
      message: "No MUnit test files found",
      recommendation: "Add MUnit tests in src/test/munit/ for critical flows",
      autoFixable: false,
    });
  }

  return findings;
}

function calculateHealthScore(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) {
    switch (f.severity) {
      case "critical": score -= 15; break;
      case "warning": score -= 5; break;
      case "info": score -= 1; break;
    }
  }
  return Math.max(0, Math.min(100, score));
}

export function cloneIfNeeded(source: string): string {
  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("git@")) {
    const tmpDir = path.join("/tmp", `orca-scan-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    execSync(`git clone --depth 1 ${source} ${tmpDir}`, { timeout: 60000 });
    return tmpDir;
  }
  if (!fs.existsSync(source)) {
    throw new Error(`Path does not exist: ${source}`);
  }
  return source;
}

export function analyzeMuleProject(source: string): ScanResult {
  const projectPath = cloneIfNeeded(source);
  const projectName = path.basename(projectPath);

  const inventory = buildInventory(projectPath);
  const findings = [
    ...runSecurityRules(projectPath, inventory),
    ...runNamingRules(projectPath, inventory),
    ...runStructureRules(projectPath, inventory),
    ...runBestPracticeRules(projectPath, inventory),
  ];

  const healthScore = calculateHealthScore(findings);
  const criticalCount = findings.filter(f => f.severity === "critical").length;
  const warningCount = findings.filter(f => f.severity === "warning").length;
  const infoCount = findings.filter(f => f.severity === "info").length;
  const migrationReady = criticalCount === 0;

  return {
    projectName,
    sourceUrl: source !== projectPath ? source : null,
    findings,
    healthScore,
    totalFindings: findings.length,
    criticalCount,
    warningCount,
    infoCount,
    migrationReady,
    inventory,
  };
}

export function saveScanResult(result: ScanResult, workspaceId = 1): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO scan_results (project_name, source_url, total_findings, critical_count, warning_count, info_count, health_score, migration_ready, results_json, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    result.projectName,
    result.sourceUrl,
    result.totalFindings,
    result.criticalCount,
    result.warningCount,
    result.infoCount,
    result.healthScore,
    result.migrationReady ? 1 : 0,
    JSON.stringify({ findings: result.findings, inventory: result.inventory }),
    workspaceId
  );
  const row = db.query("SELECT last_insert_rowid() as id").get() as { id: number };
  return row.id;
}

export function getScanHistory(workspaceId = 1): unknown[] {
  const db = getDb();
  return db.query(
    "SELECT id, project_name, source_url, scanned_at, total_findings, critical_count, warning_count, info_count, health_score, migration_ready FROM scan_results WHERE workspace_id = ? ORDER BY scanned_at DESC LIMIT 50"
  ).all(workspaceId);
}

export function getScanById(id: number): unknown {
  const db = getDb();
  return db.query("SELECT * FROM scan_results WHERE id = ?").get(id);
}
