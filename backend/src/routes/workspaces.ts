import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getDb } from "../db/schema";
import fs from "fs";
import path from "path";

const router = Router();
router.use(authenticateToken);

const ROOT_DIR = path.join(import.meta.dir, "../../..");
const WORKSPACES_DIR = path.join(ROOT_DIR, "workspaces");

function getWorkspaceProjectsDir(name: string): string {
  return path.join(WORKSPACES_DIR, name, "projects");
}

router.get("/", (_req: Request, res: Response): void => {
  const db = getDb();
  const rows = db.query(`
    SELECT id, name, description, created_by, created_at, is_default
    FROM workspaces ORDER BY is_default DESC, created_at ASC
  `).all();

  const workspaces = (rows as any[]).map((ws) => {
    const projDir = getWorkspaceProjectsDir(ws.name);
    let projectCount = 0;
    if (fs.existsSync(projDir)) {
      projectCount = fs.readdirSync(projDir).filter((f) =>
        fs.statSync(path.join(projDir, f)).isDirectory()
      ).length;
    }
    return { ...ws, projectCount };
  });

  res.json(workspaces);
});

router.get("/:id", (req: Request, res: Response): void => {
  const db = getDb();
  const ws = db.query("SELECT * FROM workspaces WHERE id = ?").get(Number(req.params.id)) as any;
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }

  const projDir = getWorkspaceProjectsDir(ws.name);
  let projectCount = 0;
  if (fs.existsSync(projDir)) {
    projectCount = fs.readdirSync(projDir).filter((f) =>
      fs.statSync(path.join(projDir, f)).isDirectory()
    ).length;
  }

  res.json({ ...ws, projectCount });
});

router.post("/", (req: Request, res: Response): void => {
  const { name, description } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Workspace name is required" }); return;
  }

  const sanitized = name.trim();
  const db = getDb();

  const existing = db.query("SELECT id FROM workspaces WHERE name = ?").get(sanitized);
  if (existing) {
    res.status(409).json({ error: `Workspace '${sanitized}' already exists` }); return;
  }

  const username = req.user?.username || "unknown";
  db.run(
    "INSERT INTO workspaces (name, description, created_by) VALUES (?, ?, ?)",
    [sanitized, description || "", username]
  );

  const created = db.query("SELECT * FROM workspaces WHERE name = ?").get(sanitized) as any;

  const projDir = getWorkspaceProjectsDir(sanitized);
  fs.mkdirSync(projDir, { recursive: true });

  res.status(201).json(created);
});

router.patch("/:id", (req: Request, res: Response): void => {
  const db = getDb();
  const ws = db.query("SELECT * FROM workspaces WHERE id = ?").get(Number(req.params.id)) as any;
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }

  const { name, description } = req.body;

  if (name && name !== ws.name) {
    const existing = db.query("SELECT id FROM workspaces WHERE name = ? AND id != ?").get(name, ws.id);
    if (existing) {
      res.status(409).json({ error: `Workspace '${name}' already exists` }); return;
    }
    const oldDir = path.join(WORKSPACES_DIR, ws.name);
    const newDir = path.join(WORKSPACES_DIR, name);
    if (fs.existsSync(oldDir)) fs.renameSync(oldDir, newDir);
    db.run("UPDATE workspaces SET name = ? WHERE id = ?", [name, ws.id]);
  }

  if (description !== undefined) {
    db.run("UPDATE workspaces SET description = ? WHERE id = ?", [description, ws.id]);
  }

  const updated = db.query("SELECT * FROM workspaces WHERE id = ?").get(ws.id);
  res.json(updated);
});

router.delete("/:id", (req: Request, res: Response): void => {
  const db = getDb();
  const ws = db.query("SELECT * FROM workspaces WHERE id = ?").get(Number(req.params.id)) as any;
  if (!ws) { res.status(404).json({ error: "Workspace not found" }); return; }

  if (ws.is_default) {
    res.status(400).json({ error: "Cannot delete the default workspace" }); return;
  }

  const wsDir = path.join(WORKSPACES_DIR, ws.name);
  if (fs.existsSync(wsDir)) {
    fs.rmSync(wsDir, { recursive: true, force: true });
  }

  db.run("DELETE FROM test_runs WHERE workspace_id = ?", [ws.id]);
  db.run("DELETE FROM api_metrics WHERE workspace_id = ?", [ws.id]);
  db.run("DELETE FROM workspaces WHERE id = ?", [ws.id]);

  res.json({ message: `Workspace '${ws.name}' deleted` });
});

export default router;
