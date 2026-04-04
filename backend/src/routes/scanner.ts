import { Router } from "express";
import { analyzeMuleProject, saveScanResult, getScanHistory, getScanById, RULES } from "../services/scanner";
import { generateMigrationPlan, executeMigration, getMigration } from "../services/migrator";

const router = Router();

router.post("/analyze", (req, res) => {
  const { source } = req.body;
  if (!source || typeof source !== "string") {
    return res.status(400).json({ error: "source (path or Git URL) is required" });
  }
  try {
    const result = analyzeMuleProject(source.trim());
    const workspaceId = (req as any).workspaceId || 1;
    const scanId = saveScanResult(result, workspaceId);
    res.json({ ...result, id: scanId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/rules", (_req, res) => {
  res.json(RULES);
});

router.get("/history", (req, res) => {
  const workspaceId = (req as any).workspaceId || 1;
  res.json(getScanHistory(workspaceId));
});

router.get("/result/:id", (req, res) => {
  const row = getScanById(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "Scan not found" });
  res.json(row);
});

router.post("/migrate/plan", (req, res) => {
  const { scanId, sourcePath } = req.body;
  if (!scanId || !sourcePath) {
    return res.status(400).json({ error: "scanId and sourcePath are required" });
  }
  try {
    const row = getScanById(scanId) as any;
    if (!row) return res.status(404).json({ error: "Scan not found" });
    const scanData = JSON.parse(row.results_json);
    const scanResult = {
      projectName: row.project_name,
      sourceUrl: row.source_url,
      findings: scanData.findings,
      healthScore: row.health_score,
      totalFindings: row.total_findings,
      criticalCount: row.critical_count,
      warningCount: row.warning_count,
      infoCount: row.info_count,
      migrationReady: !!row.migration_ready,
      inventory: scanData.inventory,
    };
    const plan = generateMigrationPlan(scanResult, sourcePath);
    const workspaceId = (req as any).workspaceId || 1;
    const { getDb } = require("../db/schema");
    const db = getDb();
    db.run(
      "INSERT INTO migrations (scan_id, source_path, target_workspace_id, plan_json) VALUES (?, ?, ?, ?)",
      [scanId, sourcePath, workspaceId, JSON.stringify(plan)]
    );
    const id = (db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id;
    res.json({ id, plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/migrate/execute", (req, res) => {
  const { migrationId } = req.body;
  if (!migrationId) {
    return res.status(400).json({ error: "migrationId is required" });
  }
  try {
    const migration = getMigration(migrationId);
    if (!migration) return res.status(404).json({ error: "Migration not found" });
    const result = executeMigration(migrationId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/migrate/status/:id", (req, res) => {
  const migration = getMigration(Number(req.params.id));
  if (!migration) return res.status(404).json({ error: "Migration not found" });
  res.json(migration);
});

export default router;
