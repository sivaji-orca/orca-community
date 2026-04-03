import { Router, Request, Response } from "express";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

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

export default router;
