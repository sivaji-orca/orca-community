import fs from "fs";
import path from "path";

const SOFTWARES_DIR = path.join(import.meta.dir, "../../../softwares");
const MULE_LOG = path.join(SOFTWARES_DIR, "mule-standalone/logs/mule_ee.log");
const WIREMOCK_DIR = path.join(SOFTWARES_DIR, "wiremock");

export interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  source: "mule" | "wiremock";
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER = 10000;

function addEntry(entry: LogEntry): void {
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();
}

const sseClients: Set<(entry: LogEntry) => void> = new Set();

export function addSSEClient(cb: (entry: LogEntry) => void): () => void {
  sseClients.add(cb);
  return () => sseClients.delete(cb);
}

function broadcast(entry: LogEntry): void {
  for (const cb of sseClients) cb(entry);
}

function parseMuleLine(line: string): LogEntry | null {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+\[([^\]]*)\]\s+(\w+)\s+(\S+)\s*-\s*(.*)/);
  if (match) {
    return { timestamp: match[1], level: match[3], logger: match[4], message: match[5], source: "mule" };
  }
  const simple = line.match(/^(\w+)\s*:\s*(.*)/);
  if (simple && ["INFO", "WARN", "ERROR", "DEBUG"].includes(simple[1])) {
    return { timestamp: new Date().toISOString(), level: simple[1], logger: "mule", message: simple[2], source: "mule" };
  }
  if (line.trim()) {
    return { timestamp: new Date().toISOString(), level: "INFO", logger: "mule", message: line.trim(), source: "mule" };
  }
  return null;
}

let watching = false;
let lastMuleSize = 0;

export function startWatching(): void {
  if (watching) return;
  watching = true;

  const poll = () => {
    if (fs.existsSync(MULE_LOG)) {
      const stat = fs.statSync(MULE_LOG);
      if (stat.size > lastMuleSize) {
        const fd = fs.openSync(MULE_LOG, "r");
        const buf = Buffer.alloc(stat.size - lastMuleSize);
        fs.readSync(fd, buf, 0, buf.length, lastMuleSize);
        fs.closeSync(fd);
        lastMuleSize = stat.size;
        const lines = buf.toString("utf8").split("\n");
        for (const line of lines) {
          const entry = parseMuleLine(line);
          if (entry) { addEntry(entry); broadcast(entry); }
        }
      }
    }
  };

  setInterval(poll, 2000);
}

export function getLogs(opts: { source?: string; level?: string; search?: string; limit?: number }): LogEntry[] {
  let results = LOG_BUFFER;
  if (opts.source) results = results.filter((e) => e.source === opts.source);
  if (opts.level) results = results.filter((e) => e.level === opts.level);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    results = results.filter((e) => e.message.toLowerCase().includes(q) || e.logger.toLowerCase().includes(q));
  }
  const limit = opts.limit || 200;
  return results.slice(-limit);
}

export function getLogStats(): { total: number; error: number; warn: number; info: number; debug: number; lastError: string | null } {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const recent = LOG_BUFFER.filter((e) => e.timestamp >= oneHourAgo);
  const errors = recent.filter((e) => e.level === "ERROR");
  return {
    total: recent.length,
    error: errors.length,
    warn: recent.filter((e) => e.level === "WARN").length,
    info: recent.filter((e) => e.level === "INFO").length,
    debug: recent.filter((e) => e.level === "DEBUG").length,
    lastError: errors.length > 0 ? errors[errors.length - 1].timestamp : null,
  };
}

export function loadInitialLogs(): void {
  if (fs.existsSync(MULE_LOG)) {
    const content = fs.readFileSync(MULE_LOG, "utf8");
    const lines = content.split("\n").slice(-500);
    for (const line of lines) {
      const entry = parseMuleLine(line);
      if (entry) addEntry(entry);
    }
    lastMuleSize = fs.statSync(MULE_LOG).size;
  }
}
