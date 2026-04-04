import { Router, Request, Response } from "express";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { setSecret, getSecret } from "../services/vault";

const router = Router();

const SOFTWARES_DIR = path.join(import.meta.dir, "../../../softwares");
const MULE_HOME = path.join(SOFTWARES_DIR, "mule-standalone");
const WIREMOCK_JAR = path.join(SOFTWARES_DIR, "wiremock/wiremock-standalone.jar");

interface Prerequisite {
  name: string;
  label: string;
  required: boolean;
  installed: boolean;
  version: string;
  meetsMinimum: boolean;
  description: string;
  installCommand: Record<string, string>;
}

function detectOS(): "macos" | "linux" | "windows" {
  const platform = os.platform();
  if (platform === "darwin") return "macos";
  if (platform === "win32") return "windows";
  return "linux";
}

function runCommand(cmd: string): string | null {
  try {
    return execSync(cmd, { timeout: 10000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function parseVersion(raw: string): number[] {
  const match = raw.match(/(\d+)\.(\d+)\.?(\d*)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3] || "0")];
}

function versionAtLeast(version: number[], min: number[]): boolean {
  for (let i = 0; i < min.length; i++) {
    if ((version[i] || 0) > (min[i] || 0)) return true;
    if ((version[i] || 0) < (min[i] || 0)) return false;
  }
  return true;
}

function checkJava(): Prerequisite {
  const result: Prerequisite = {
    name: "java",
    label: "Java 17+",
    required: true,
    installed: false,
    version: "Not found",
    meetsMinimum: false,
    description: "Required by MuleSoft Runtime and Maven to build and run Mule applications",
    installCommand: {
      macos: "brew install openjdk@17",
      linux: "sudo apt install openjdk-17-jdk",
      windows: "winget install EclipseAdoptium.Temurin.17.JDK",
    },
  };

  const javaPaths = [
    "/opt/homebrew/opt/openjdk@17/bin/java",
    "/opt/homebrew/opt/openjdk/bin/java",
    "/usr/local/opt/openjdk@17/bin/java",
    "java",
  ];

  let output: string | null = null;
  for (const jp of javaPaths) {
    output = runCommand(`"${jp}" -version 2>&1`);
    if (output && output.match(/(?:openjdk|java) version/)) break;
  }

  if (!output || !output.match(/(?:openjdk|java) version/)) {
    output = runCommand("java -version 2>&1");
    if (!output) return result;
  }

  const vMatch = output.match(/(?:openjdk|java) version "([^"]+)"/) || output.match(/(\d+\.\d+\.\d+)/);
  if (vMatch) {
    result.installed = true;
    result.version = vMatch[1];
    const parts = parseVersion(vMatch[1]);
    const major = parts[0] === 1 ? parts[1] : parts[0];
    result.meetsMinimum = major >= 17;
  }

  return result;
}

function checkMaven(): Prerequisite {
  const result: Prerequisite = {
    name: "maven",
    label: "Maven 3.8+",
    required: true,
    installed: false,
    version: "Not found",
    meetsMinimum: false,
    description: "Builds MuleSoft projects and downloads dependencies from Anypoint Exchange",
    installCommand: {
      macos: "brew install maven",
      linux: "sudo apt install maven",
      windows: "winget install Apache.Maven",
    },
  };

  const output = runCommand("mvn -version 2>&1");
  if (!output) return result;

  result.installed = true;
  const vMatch = output.match(/Apache Maven (\d+\.\d+\.\d+)/);
  if (vMatch) {
    result.version = vMatch[1];
    result.meetsMinimum = versionAtLeast(parseVersion(vMatch[1]), [3, 8, 0]);
  } else {
    result.version = output.split("\n")[0];
  }

  return result;
}

function checkGit(): Prerequisite {
  const result: Prerequisite = {
    name: "git",
    label: "Git",
    required: true,
    installed: false,
    version: "Not found",
    meetsMinimum: false,
    description: "Version control for managing your MuleSoft projects and contributing to Orca",
    installCommand: {
      macos: "brew install git",
      linux: "sudo apt install git",
      windows: "winget install Git.Git",
    },
  };

  const output = runCommand("git --version 2>&1");
  if (!output) return result;

  result.installed = true;
  const vMatch = output.match(/git version (\d+\.\d+\.\d+)/);
  result.version = vMatch ? vMatch[1] : output.trim();
  result.meetsMinimum = true;

  return result;
}

function checkBun(): Prerequisite {
  return {
    name: "bun",
    label: "Bun",
    required: true,
    installed: true,
    version: typeof Bun !== "undefined" ? Bun.version : "unknown",
    meetsMinimum: true,
    description: "JavaScript runtime powering the Orca dashboard backend and frontend",
    installCommand: {
      macos: "curl -fsSL https://bun.sh/install | bash",
      linux: "curl -fsSL https://bun.sh/install | bash",
      windows: "powershell -c \"irm bun.sh/install.ps1 | iex\"",
    },
  };
}

function checkMuleRuntime(): Prerequisite {
  const installed = fs.existsSync(path.join(MULE_HOME, "bin/mule"));
  return {
    name: "mule-runtime",
    label: "MuleSoft Runtime",
    required: false,
    installed,
    version: installed ? "4.11.2 Standalone" : "Not found",
    meetsMinimum: installed,
    description: "Local Mule runtime for deploying and testing APIs. Downloaded automatically by setup script.",
    installCommand: {
      macos: "./scripts/setup.sh  # Downloads Mule Runtime automatically",
      linux: "./scripts/setup.sh  # Downloads Mule Runtime automatically",
      windows: "./scripts/setup.sh  # Downloads Mule Runtime automatically",
    },
  };
}

function checkWiremock(): Prerequisite {
  const installed = fs.existsSync(WIREMOCK_JAR);
  return {
    name: "wiremock",
    label: "WireMock",
    required: false,
    installed,
    version: installed ? "Standalone JAR" : "Not found",
    meetsMinimum: installed,
    description: "HTTP mock server for simulating Salesforce and external APIs during local development",
    installCommand: {
      macos: "./scripts/setup.sh  # Downloads WireMock automatically",
      linux: "./scripts/setup.sh  # Downloads WireMock automatically",
      windows: "./scripts/setup.sh  # Downloads WireMock automatically",
    },
  };
}

router.get("/prerequisites", (_req: Request, res: Response): void => {
  const prerequisites = [
    checkJava(),
    checkMaven(),
    checkGit(),
    checkBun(),
    checkMuleRuntime(),
    checkWiremock(),
  ];

  const requiredPassed = prerequisites
    .filter((p) => p.required)
    .every((p) => p.installed && p.meetsMinimum);

  const allPassed = prerequisites.every((p) => p.installed && p.meetsMinimum);

  res.json({
    os: detectOS(),
    prerequisites,
    requiredPassed,
    allPassed,
  });
});

router.post("/install-guide", (req: Request, res: Response): void => {
  const { tool } = req.body;
  const currentOS = detectOS();

  const guides: Record<string, { steps: string[]; command: string; docs: string }> = {
    java: {
      steps: [
        "Install Java 17 (required by MuleSoft Runtime)",
        currentOS === "macos"
          ? "Run: brew install openjdk@17"
          : currentOS === "linux"
            ? "Run: sudo apt install openjdk-17-jdk"
            : "Run: winget install EclipseAdoptium.Temurin.17.JDK",
        "Verify: java -version (should show 17.x)",
        currentOS !== "windows"
          ? "If java is not found after install, add to PATH:\n  export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo /usr/lib/jvm/java-17-openjdk-amd64)\n  export PATH=$JAVA_HOME/bin:$PATH"
          : "Restart your terminal after installation",
      ],
      command: currentOS === "macos" ? "brew install openjdk@17" : currentOS === "linux" ? "sudo apt install openjdk-17-jdk" : "winget install EclipseAdoptium.Temurin.17.JDK",
      docs: "https://adoptium.net/installation/",
    },
    maven: {
      steps: [
        "Install Maven 3.8+ (builds MuleSoft projects)",
        currentOS === "macos"
          ? "Run: brew install maven"
          : currentOS === "linux"
            ? "Run: sudo apt install maven"
            : "Run: winget install Apache.Maven",
        "Verify: mvn -version (should show 3.8+)",
      ],
      command: currentOS === "macos" ? "brew install maven" : currentOS === "linux" ? "sudo apt install maven" : "winget install Apache.Maven",
      docs: "https://maven.apache.org/install.html",
    },
    git: {
      steps: [
        "Install Git (version control)",
        currentOS === "macos"
          ? "Run: brew install git"
          : currentOS === "linux"
            ? "Run: sudo apt install git"
            : "Run: winget install Git.Git",
        "Verify: git --version",
      ],
      command: currentOS === "macos" ? "brew install git" : currentOS === "linux" ? "sudo apt install git" : "winget install Git.Git",
      docs: "https://git-scm.com/downloads",
    },
    bun: {
      steps: [
        "Install Bun (JavaScript runtime)",
        currentOS !== "windows"
          ? "Run: curl -fsSL https://bun.sh/install | bash"
          : "Run: powershell -c \"irm bun.sh/install.ps1 | iex\"",
        "Restart your terminal, then verify: bun --version",
      ],
      command: currentOS !== "windows" ? "curl -fsSL https://bun.sh/install | bash" : "powershell -c \"irm bun.sh/install.ps1 | iex\"",
      docs: "https://bun.sh/docs/installation",
    },
  };

  const guide = guides[tool];
  if (!guide) {
    res.status(400).json({ error: `Unknown tool: ${tool}` });
    return;
  }

  res.json({ tool, os: currentOS, ...guide });
});

// ── Configure credentials from the onboarding UI ──────────────────────
const ROOT_DIR = path.join(import.meta.dir, "../../..");
const CONFIG_TEMPLATE = path.join(ROOT_DIR, "config.template.yaml");
const CONFIG_FILE = path.join(ROOT_DIR, "config.yaml");
const M2_DIR = path.join(os.homedir(), ".m2");
const SETTINGS_XML = path.join(M2_DIR, "settings.xml");

function ensureConfigYaml(): void {
  if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(CONFIG_TEMPLATE)) {
    fs.copyFileSync(CONFIG_TEMPLATE, CONFIG_FILE);
  }
}

function updateConfigYamlField(field: string, value: string): void {
  if (!fs.existsSync(CONFIG_FILE)) return;
  let content = fs.readFileSync(CONFIG_FILE, "utf8");
  const regex = new RegExp(`(${field}:\\s*)(".*?"|'.*?'|\\S*)`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `$1"${value}"`);
  }
  fs.writeFileSync(CONFIG_FILE, content, "utf8");
}

function ensureMavenSettings(clientId: string, clientSecret: string): { updated: boolean; message: string } {
  try {
    if (!fs.existsSync(M2_DIR)) fs.mkdirSync(M2_DIR, { recursive: true });

    const password = `${clientId}~?~${clientSecret}`;

    if (fs.existsSync(SETTINGS_XML)) {
      let content = fs.readFileSync(SETTINGS_XML, "utf8");
      if (content.includes("anypoint-exchange-v3")) {
        content = content.replace(
          /(<server>\s*<id>anypoint-exchange-v3<\/id>\s*<username>~~~Client~~~<\/username>\s*<password>)[^<]*(<\/password>)/,
          `$1${password}$2`
        );
        fs.writeFileSync(SETTINGS_XML, content, "utf8");
        return { updated: true, message: "Updated existing Maven settings.xml with Anypoint credentials" };
      }
      const serverBlock = `\n        <server>\n            <id>anypoint-exchange-v3</id>\n            <username>~~~Client~~~</username>\n            <password>${password}</password>\n        </server>`;
      if (content.includes("</servers>")) {
        content = content.replace("</servers>", serverBlock + "\n    </servers>");
      } else if (content.includes("</settings>")) {
        content = content.replace("</settings>", `    <servers>${serverBlock}\n    </servers>\n</settings>`);
      }
      fs.writeFileSync(SETTINGS_XML, content, "utf8");
      return { updated: true, message: "Added Anypoint Exchange entry to existing Maven settings.xml" };
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 http://maven.apache.org/xsd/settings-1.0.0.xsd">
    <servers>
        <server>
            <id>anypoint-exchange-v3</id>
            <username>~~~Client~~~</username>
            <password>${password}</password>
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
        </profile>
    </profiles>
    <activeProfiles>
        <activeProfile>mulesoft</activeProfile>
    </activeProfiles>
</settings>`;
    fs.writeFileSync(SETTINGS_XML, xml, "utf8");
    return { updated: true, message: "Created Maven settings.xml with Anypoint credentials and MuleSoft repos" };
  } catch (err) {
    return { updated: false, message: `Maven settings.xml update failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

interface ConfigureBody {
  anypoint?: { client_id?: string; client_secret?: string; org_id?: string; environment?: string };
  github?: { token?: string; org?: string };
  postman?: { api_key?: string };
  neon?: { database_url?: string; host?: string; database?: string; username?: string; password?: string };
  salesforce?: { instance_url?: string; username?: string; password?: string; security_token?: string };
  kafka?: { bootstrap_servers?: string; api_key?: string; api_secret?: string; schema_registry_url?: string; schema_registry_api_key?: string; schema_registry_api_secret?: string };
}

router.post("/configure", (req: Request, res: Response): void => {
  const body: ConfigureBody = req.body;
  const results: string[] = [];

  try {
    ensureConfigYaml();

    if (body.anypoint) {
      const { client_id, client_secret, org_id, environment } = body.anypoint;
      if (client_id) {
        setSecret("anypoint_client_id", client_id, "anypoint");
        updateConfigYamlField("client_id", client_id);
        results.push("Anypoint Client ID saved to vault");
      }
      if (client_secret) {
        setSecret("anypoint_client_secret", client_secret, "anypoint");
        updateConfigYamlField("client_secret", client_secret);
        results.push("Anypoint Client Secret saved to vault");
      }
      if (org_id) {
        setSecret("anypoint_org_id", org_id, "anypoint");
        updateConfigYamlField("org_id", org_id);
        results.push("Anypoint Org ID saved to vault");
      }
      if (environment) {
        updateConfigYamlField("environment", environment);
        results.push(`Environment set to ${environment}`);
      }
      if (client_id && client_secret) {
        const maven = ensureMavenSettings(client_id, client_secret);
        results.push(maven.message);
      }
    }

    if (body.github) {
      const { token, org } = body.github;
      if (token) {
        setSecret("github_token", token, "github");
        updateConfigYamlField("token", token);
        results.push("GitHub token saved to vault");
      }
      if (org) {
        setSecret("github_org", org, "github");
        results.push("GitHub org saved");
      }
    }

    if (body.postman?.api_key) {
      setSecret("postman_api_key", body.postman.api_key, "postman");
      results.push("Postman API key saved to vault");
    }

    if (body.neon) {
      const { database_url, host, database, username, password } = body.neon;
      if (database_url) {
        setSecret("neon_database_url", database_url, "neon");
        results.push("Neon database URL saved to vault");
      }
      if (host) { setSecret("neon_host", host, "neon"); results.push("Neon host saved"); }
      if (database) { setSecret("neon_database", database, "neon"); results.push("Neon database name saved"); }
      if (username) { setSecret("neon_username", username, "neon"); results.push("Neon username saved"); }
      if (password) { setSecret("neon_password", password, "neon"); results.push("Neon password saved to vault"); }
    }

    if (body.salesforce) {
      const { instance_url, username, password, security_token } = body.salesforce;
      if (instance_url) { setSecret("salesforce_instance_url", instance_url, "salesforce"); results.push("Salesforce instance URL saved"); }
      if (username) { setSecret("salesforce_username", username, "salesforce"); results.push("Salesforce username saved"); }
      if (password) { setSecret("salesforce_password", password, "salesforce"); results.push("Salesforce password saved to vault"); }
      if (security_token) { setSecret("salesforce_security_token", security_token, "salesforce"); results.push("Salesforce security token saved to vault"); }
    }

    if (body.kafka) {
      const { bootstrap_servers, api_key, api_secret, schema_registry_url, schema_registry_api_key, schema_registry_api_secret } = body.kafka;
      if (bootstrap_servers) { setSecret("kafka_bootstrap_servers", bootstrap_servers, "kafka"); results.push("Kafka bootstrap servers saved"); }
      if (api_key) { setSecret("kafka_api_key", api_key, "kafka"); results.push("Kafka API key saved to vault"); }
      if (api_secret) { setSecret("kafka_api_secret", api_secret, "kafka"); results.push("Kafka API secret saved to vault"); }
      if (schema_registry_url) { setSecret("kafka_schema_registry_url", schema_registry_url, "kafka"); results.push("Schema Registry URL saved"); }
      if (schema_registry_api_key) { setSecret("kafka_sr_api_key", schema_registry_api_key, "kafka"); results.push("Schema Registry API key saved"); }
      if (schema_registry_api_secret) { setSecret("kafka_sr_api_secret", schema_registry_api_secret, "kafka"); results.push("Schema Registry API secret saved to vault"); }
    }

    res.json({
      success: true,
      message: results.length > 0 ? "Configuration saved successfully" : "No credentials provided",
      details: results,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Configuration failed",
      details: results,
    });
  }
});

router.get("/configure/status", (_req: Request, res: Response): void => {
  const anypoint = {
    client_id: !!getSecret("anypoint_client_id"),
    client_secret: !!getSecret("anypoint_client_secret"),
    org_id: !!getSecret("anypoint_org_id"),
  };
  const github = { token: !!getSecret("github_token") };
  const postman = { api_key: !!getSecret("postman_api_key") };
  const neon = { database_url: !!getSecret("neon_database_url") };
  const salesforce = {
    instance_url: !!getSecret("salesforce_instance_url"),
    username: !!getSecret("salesforce_username"),
    password: !!getSecret("salesforce_password"),
    security_token: !!getSecret("salesforce_security_token"),
  };

  const kafka = {
    bootstrap_servers: !!getSecret("kafka_bootstrap_servers"),
    api_key: !!getSecret("kafka_api_key"),
  };

  res.json({
    configured: anypoint.client_id && anypoint.client_secret,
    anypoint,
    github,
    postman,
    neon,
    salesforce,
    kafka,
  });
});

router.get("/test-kafka", async (_req: Request, res: Response): Promise<void> => {
  const bootstrapServers = getSecret("kafka_bootstrap_servers");
  const apiKey = getSecret("kafka_api_key");
  const apiSecret = getSecret("kafka_api_secret");
  if (!bootstrapServers || !apiKey || !apiSecret) {
    res.json({ success: false, message: "Kafka credentials not fully configured. Add bootstrap servers, API key, and API secret." });
    return;
  }
  try {
    const { Kafka } = await import("kafkajs");
    const kafka = new Kafka({
      clientId: "orca-test",
      brokers: bootstrapServers.split(","),
      ssl: true,
      sasl: { mechanism: "plain", username: apiKey, password: apiSecret },
      connectionTimeout: 10000,
    });
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();
    res.json({ success: true, message: `Connected to Confluent Cloud. Found ${topics.length} topics.`, topics: topics.slice(0, 20) });
  } catch (err) {
    res.json({ success: false, message: `Kafka connection failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

router.get("/test-neon", async (_req: Request, res: Response): Promise<void> => {
  const dbUrl = getSecret("neon_database_url");
  if (!dbUrl) {
    res.json({ success: false, message: "Neon database URL not configured. Add it in Settings or Onboarding." });
    return;
  }
  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
    await client.connect();
    const result = await client.query("SELECT 1 as connected");
    await client.end();
    res.json({ success: true, message: "Connected to Neon PostgreSQL successfully", data: result.rows });
  } catch (err) {
    res.json({ success: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

export default router;
