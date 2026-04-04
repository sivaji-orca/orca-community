import { getDb } from "../db/schema";
import fs from "fs";
import path from "path";

const SOFTWARES_DIR = path.join(import.meta.dir, "../../../softwares");
const MULE_LOG = path.join(SOFTWARES_DIR, "mule-standalone/logs/mule_ee.log");

export function recordMetric(endpoint: string, method: string, statusCode: number, responseTimeMs: number, projectName: string, workspaceId = 1): void {
  const db = getDb();
  db.run(
    "INSERT INTO api_metrics (endpoint, method, status_code, response_time_ms, project_name, workspace_id) VALUES (?, ?, ?, ?, ?, ?)",
    [endpoint, method, statusCode, responseTimeMs, projectName, workspaceId]
  );
}

function buildWhere(conditions: string[]): string {
  return conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
}

export function getSummary(projectName?: string, hours = 24, workspaceId?: number): any {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const conds: string[] = ["timestamp >= ?"];
  const params: any[] = [since];
  if (projectName) { conds.push("project_name = ?"); params.push(projectName); }
  if (workspaceId) { conds.push("workspace_id = ?"); params.push(workspaceId); }
  const where = buildWhere(conds);

  const total = db.query(`SELECT COUNT(*) as c FROM api_metrics ${where}`).get(...params) as any;
  const errors = db.query(`SELECT COUNT(*) as c FROM api_metrics ${where} AND status_code >= 400`).get(...params) as any;
  const avgTime = db.query(`SELECT AVG(response_time_ms) as avg FROM api_metrics ${where}`).get(...params) as any;

  const totalCount = total?.c || 0;
  const errorCount = errors?.c || 0;
  return {
    totalRequests: totalCount,
    errorCount,
    successRate: totalCount > 0 ? Math.round(((totalCount - errorCount) / totalCount) * 100 * 10) / 10 : 100,
    avgResponseTime: Math.round(avgTime?.avg || 0),
  };
}

export function getTimeline(projectName?: string, hours = 24, workspaceId?: number): any[] {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const conds: string[] = ["timestamp >= ?"];
  const params: any[] = [since];
  if (projectName) { conds.push("project_name = ?"); params.push(projectName); }
  if (workspaceId) { conds.push("workspace_id = ?"); params.push(workspaceId); }
  const where = buildWhere(conds);

  const rows = db.query(`
    SELECT strftime('%Y-%m-%d %H:00', timestamp) as hour,
           COUNT(*) as total,
           SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
           AVG(response_time_ms) as avg_time
    FROM api_metrics ${where}
    GROUP BY hour ORDER BY hour
  `).all(...params);
  return rows as any[];
}

export function getRecentErrors(projectName?: string, limit = 50, workspaceId?: number): any[] {
  const db = getDb();
  const conds: string[] = ["status_code >= 400"];
  const params: any[] = [];
  if (projectName) { conds.push("project_name = ?"); params.push(projectName); }
  if (workspaceId) { conds.push("workspace_id = ?"); params.push(workspaceId); }
  const where = buildWhere(conds);
  params.push(limit);

  const rows = db.query(
    `SELECT * FROM api_metrics ${where} ORDER BY timestamp DESC LIMIT ?`
  ).all(...params);
  return rows as any[];
}

export function getEndpointBreakdown(projectName?: string, workspaceId?: number): any[] {
  const db = getDb();
  const conds: string[] = [];
  const params: any[] = [];
  if (projectName) { conds.push("project_name = ?"); params.push(projectName); }
  if (workspaceId) { conds.push("workspace_id = ?"); params.push(workspaceId); }
  const where = buildWhere(conds);

  const rows = db.query(`
    SELECT endpoint, method,
           COUNT(*) as total_calls,
           AVG(response_time_ms) as avg_time,
           SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
    FROM api_metrics ${where}
    GROUP BY endpoint, method ORDER BY total_calls DESC
  `).all(...params);
  return rows as any[];
}

let parseInterval: ReturnType<typeof setInterval> | null = null;
let lastParsedSize = 0;

export function startMetricsParsing(): void {
  if (parseInterval) return;

  parseInterval = setInterval(() => {
    if (!fs.existsSync(MULE_LOG)) return;
    const stat = fs.statSync(MULE_LOG);
    if (stat.size <= lastParsedSize) return;

    const fd = fs.openSync(MULE_LOG, "r");
    const buf = Buffer.alloc(stat.size - lastParsedSize);
    fs.readSync(fd, buf, 0, buf.length, lastParsedSize);
    fs.closeSync(fd);
    lastParsedSize = stat.size;

    const lines = buf.toString("utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/HTTP\s+(GET|POST|PUT|DELETE|PATCH)\s+(\S+).*?(\d{3}).*?(\d+)ms/i);
      if (match) {
        recordMetric(match[2], match[1].toUpperCase(), parseInt(match[3]), parseInt(match[4]), "default");
      }
    }
  }, 5000);
}
