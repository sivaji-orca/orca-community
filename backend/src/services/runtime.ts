import { spawn, execSync, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

const SOFTWARES_DIR = path.join(import.meta.dir, "../../../softwares");
const MULE_HOME = path.join(SOFTWARES_DIR, "mule-standalone");
const WIREMOCK_DIR = path.join(SOFTWARES_DIR, "wiremock");
const WIREMOCK_JAR = path.join(WIREMOCK_DIR, "wiremock-standalone.jar");
const JAVA_HOME = "/opt/homebrew/opt/openjdk@17";
const JAVA_BIN = path.join(JAVA_HOME, "bin/java");

const WIREMOCK_PORT = 9090;

interface ProcessInfo {
  process: ChildProcess | null;
  pid: number | null;
  name: string;
  port: number;
  startedAt: string | null;
}

const processes: Record<string, ProcessInfo> = {
  mule: { process: null, pid: null, name: "MuleSoft Runtime 4.11.2", port: 8081, startedAt: null },
  wiremock: { process: null, pid: null, name: "WireMock", port: WIREMOCK_PORT, startedAt: null },
};

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isMuleInstalled(): boolean {
  return fs.existsSync(path.join(MULE_HOME, "bin/mule"));
}

export function isWiremockInstalled(): boolean {
  return fs.existsSync(WIREMOCK_JAR);
}

export function getSetupStatus(): { muleInstalled: boolean; wiremockInstalled: boolean; javaAvailable: boolean; javaVersion: string } {
  let javaVersion = "Not found";
  let javaAvailable = false;
  try {
    const output = execSync(`"${JAVA_BIN}" -version 2>&1`).toString();
    const match = output.match(/openjdk version "([^"]+)"/);
    javaVersion = match ? match[1] : output.split("\n")[0];
    javaAvailable = true;
  } catch { /* noop */ }

  return {
    muleInstalled: isMuleInstalled(),
    wiremockInstalled: isWiremockInstalled(),
    javaAvailable,
    javaVersion,
  };
}

export function startMule(): string {
  if (!isMuleInstalled()) {
    throw new Error("MuleSoft Runtime not found. Run setup first.");
  }

  if (processes.mule.pid && isProcessAlive(processes.mule.pid)) {
    return "MuleSoft Runtime is already running";
  }

  const muleBin = path.join(MULE_HOME, "bin/mule");

  const child = spawn("bash", [muleBin, "console"], {
    cwd: MULE_HOME,
    env: {
      ...process.env,
      JAVA_HOME,
      MULE_HOME,
      MULE_BASE: MULE_HOME,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  processes.mule.process = child;
  processes.mule.pid = child.pid ?? null;
  processes.mule.startedAt = new Date().toISOString();

  child.unref();

  child.on("exit", () => {
    processes.mule.process = null;
    processes.mule.pid = null;
    processes.mule.startedAt = null;
  });

  return `MuleSoft Runtime started (PID: ${child.pid})`;
}

export function startWiremock(): string {
  if (!isWiremockInstalled()) {
    throw new Error("WireMock jar not found. Run setup first.");
  }

  if (processes.wiremock.pid && isProcessAlive(processes.wiremock.pid)) {
    return "WireMock is already running";
  }

  const child = spawn(JAVA_BIN, [
    "-jar", WIREMOCK_JAR,
    "--port", String(WIREMOCK_PORT),
    "--root-dir", WIREMOCK_DIR,
  ], {
    cwd: WIREMOCK_DIR,
    env: { ...process.env, JAVA_HOME },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  processes.wiremock.process = child;
  processes.wiremock.pid = child.pid ?? null;
  processes.wiremock.startedAt = new Date().toISOString();

  child.unref();

  child.on("exit", () => {
    processes.wiremock.process = null;
    processes.wiremock.pid = null;
    processes.wiremock.startedAt = null;
  });

  return `WireMock started on port ${WIREMOCK_PORT} (PID: ${child.pid})`;
}

export function stopMule(): string {
  if (!processes.mule.pid || !isProcessAlive(processes.mule.pid)) {
    processes.mule.process = null;
    processes.mule.pid = null;
    processes.mule.startedAt = null;
    return "MuleSoft Runtime is not running";
  }

  try {
    process.kill(-processes.mule.pid, "SIGTERM");
  } catch {
    try { process.kill(processes.mule.pid, "SIGTERM"); } catch { /* already dead */ }
  }

  processes.mule.process = null;
  processes.mule.pid = null;
  processes.mule.startedAt = null;
  return "MuleSoft Runtime stopped";
}

export function stopWiremock(): string {
  if (!processes.wiremock.pid || !isProcessAlive(processes.wiremock.pid)) {
    processes.wiremock.process = null;
    processes.wiremock.pid = null;
    processes.wiremock.startedAt = null;
    return "WireMock is not running";
  }

  try {
    process.kill(processes.wiremock.pid, "SIGTERM");
  } catch { /* already dead */ }

  processes.wiremock.process = null;
  processes.wiremock.pid = null;
  processes.wiremock.startedAt = null;
  return `WireMock stopped`;
}

export function startAll(): string[] {
  return [startMule(), startWiremock()];
}

export function stopAll(): string[] {
  return [stopMule(), stopWiremock()];
}

export function getServiceStatus(): Array<{ name: string; state: string; port: string; pid: number | null; startedAt: string | null }> {
  return Object.values(processes).map((info) => {
    const alive = info.pid ? isProcessAlive(info.pid) : false;
    return {
      name: info.name,
      state: alive ? "running" : "stopped",
      port: String(info.port),
      pid: alive ? info.pid : null,
      startedAt: alive ? info.startedAt : null,
    };
  });
}

export function getMuleHome(): string {
  return MULE_HOME;
}

export function getMuleLogs(lines = 50): string {
  const logFile = path.join(MULE_HOME, "logs/mule_ee.log");
  if (!fs.existsSync(logFile)) return "No log file found yet.";

  const content = fs.readFileSync(logFile, "utf8");
  const allLines = content.split("\n");
  return allLines.slice(-lines).join("\n");
}
