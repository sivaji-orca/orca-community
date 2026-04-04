import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  getCachedObjects,
  getCachedFields,
  getRelationships,
  getErdData,
  refreshAllSchema,
} from "../services/sf-schema";
import {
  generateSOQL,
  validateSOQL,
  getLlmStatus,
  getQueryTemplates,
} from "../services/sf-nlp";
import {
  runSOQL,
  getHealth,
  getOrgInfo,
  getLimits,
  createRecord as sfCreate,
  updateRecord as sfUpdate,
  deleteRecord as sfDelete,
  getRecord as sfGet,
  searchSOSL,
  describeGlobal,
} from "../services/salesforce";
import { getDb } from "../db/schema";

const router = Router();

// ── Schema Explorer ────────────────────────────────────────────────────────

router.get("/schema/objects", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    const objects = await getCachedObjects(wsId);
    res.json({ objects, count: objects.length });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/schema/objects/:name", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    const fields = await getCachedFields(req.params.name, wsId);
    const rels = await getRelationships(req.params.name, wsId);
    res.json({ objectName: req.params.name, fields, relationships: rels });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/schema/objects/:name/fields", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    let fields = await getCachedFields(req.params.name, wsId);
    const { type, custom, search } = req.query;
    if (type) fields = fields.filter((f) => f.type === type);
    if (custom === "true") fields = fields.filter((f) => f.isCustom);
    if (custom === "false") fields = fields.filter((f) => !f.isCustom);
    if (search) {
      const q = String(search).toLowerCase();
      fields = fields.filter((f) => f.fieldName.toLowerCase().includes(q) || f.label.toLowerCase().includes(q));
    }
    res.json({ objectName: req.params.name, fields, count: fields.length });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/schema/relationships/:name", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    const rels = await getRelationships(req.params.name, wsId);
    res.json({ objectName: req.params.name, ...rels });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/schema/erd", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    const objectsParam = String(req.query.objects || "Account,Contact,Opportunity");
    const objectNames = objectsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (objectNames.length > 20) {
      res.status(400).json({ error: "Maximum 20 objects for ERD" });
      return;
    }
    const erd = await getErdData(objectNames, wsId);
    res.json(erd);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/schema/refresh", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    const result = await refreshAllSchema(wsId);
    res.json({ message: "Schema cache refreshed", ...result });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// ── SOQL Workbench ─────────────────────────────────────────────────────────

router.post("/soql/execute", authenticateToken, async (req, res) => {
  try {
    const { soql } = req.body;
    if (!soql) { res.status(400).json({ error: "soql is required" }); return; }
    const wsId = (req as any).workspaceId || 1;
    const startTime = Date.now();

    const validation = validateSOQL(soql);
    if (!validation.valid) {
      res.status(400).json({ error: "Invalid SOQL", details: validation.errors });
      return;
    }

    const result = await runSOQL(soql);
    const executionTime = Date.now() - startTime;
    const rowCount = (result as any).totalSize || 0;

    try {
      const db = getDb();
      db.run(
        "INSERT INTO sf_soql_history (query_text, execution_time_ms, row_count, success, workspace_id) VALUES (?, ?, ?, 1, ?)",
        [soql, executionTime, rowCount, wsId]
      );
    } catch {}

    res.json({ ...result, executionTimeMs: executionTime });
  } catch (e: any) {
    try {
      const db = getDb();
      const wsId = (req as any).workspaceId || 1;
      db.run(
        "INSERT INTO sf_soql_history (query_text, success, error_message, workspace_id) VALUES (?, 0, ?, ?)",
        [req.body.soql, e.message, wsId]
      );
    } catch {}
    res.status(502).json({ error: e.message });
  }
});

router.post("/soql/nlp", authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) { res.status(400).json({ error: "query is required" }); return; }
    const wsId = (req as any).workspaceId || 1;
    const result = await generateSOQL(query, wsId);
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/soql/validate", authenticateToken, async (req, res) => {
  try {
    const { soql } = req.body;
    if (!soql) { res.status(400).json({ error: "soql is required" }); return; }
    const result = validateSOQL(soql);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/soql/history", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    const limit = Math.min(parseInt(String(req.query.limit || "50")), 200);
    const search = req.query.search ? String(req.query.search) : null;
    const db = getDb();

    let rows;
    if (search) {
      rows = db.query(
        "SELECT * FROM sf_soql_history WHERE workspace_id = ? AND query_text LIKE ? ORDER BY executed_at DESC LIMIT ?"
      ).all(wsId, `%${search}%`, limit);
    } else {
      rows = db.query(
        "SELECT * FROM sf_soql_history WHERE workspace_id = ? ORDER BY executed_at DESC LIMIT ?"
      ).all(wsId, limit);
    }
    res.json({ history: rows, count: (rows as any[]).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/soql/favorites", authenticateToken, async (req, res) => {
  try {
    const wsId = (req as any).workspaceId || 1;
    const db = getDb();
    const rows = db.query(
      "SELECT * FROM sf_soql_favorites WHERE workspace_id = ? ORDER BY updated_at DESC"
    ).all(wsId);
    res.json({ favorites: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/soql/favorites", authenticateToken, async (req, res) => {
  try {
    const { name, description, queryText, tags } = req.body;
    if (!name || !queryText) { res.status(400).json({ error: "name and queryText required" }); return; }
    const wsId = (req as any).workspaceId || 1;
    const db = getDb();
    db.run(
      "INSERT INTO sf_soql_favorites (name, description, query_text, tags, workspace_id) VALUES (?, ?, ?, ?, ?)",
      [name, description || "", queryText, JSON.stringify(tags || []), wsId]
    );
    res.json({ message: "Favorite saved" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/soql/favorites/:id", authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    db.run("DELETE FROM sf_soql_favorites WHERE id = ?", [req.params.id]);
    res.json({ message: "Favorite deleted" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/soql/templates", authenticateToken, async (_req, res) => {
  res.json({ templates: getQueryTemplates() });
});

router.get("/soql/llm-status", authenticateToken, async (_req, res) => {
  res.json(getLlmStatus());
});

// ── Record Browser ─────────────────────────────────────────────────────────

router.get("/records/:object", authenticateToken, async (req, res) => {
  try {
    const { object } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit || "50")), 2000);
    const offset = parseInt(String(req.query.offset || "0"));
    const fields = req.query.fields ? String(req.query.fields) : "Id, Name";
    const orderBy = req.query.orderBy ? String(req.query.orderBy) : "Name";
    const where = req.query.where ? ` WHERE ${req.query.where}` : "";

    const soql = `SELECT ${fields} FROM ${object}${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
    const result = await runSOQL(soql);
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/records/:object/:id", authenticateToken, async (req, res) => {
  try {
    const record = await sfGet(req.params.object, req.params.id);
    res.json(record);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/records/:object", authenticateToken, async (req, res) => {
  try {
    const result = await sfCreate(req.params.object, req.body);
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.patch("/records/:object/:id", authenticateToken, async (req, res) => {
  try {
    const data = { ...req.body, Id: req.params.id };
    const result = await sfUpdate(req.params.object, data);
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.delete("/records/:object/:id", authenticateToken, async (req, res) => {
  try {
    const result = await sfDelete(req.params.object, req.params.id);
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/search", authenticateToken, async (req, res) => {
  try {
    const q = String(req.query.q || "");
    if (!q) { res.status(400).json({ error: "q parameter required" }); return; }
    const objects = req.query.objects ? String(req.query.objects) : "Account, Contact, Opportunity, Lead";
    const returning = objects.split(",").map((o) => `${o.trim()}(Id, Name)`).join(", ");
    const sosl = `FIND {${q}} IN ALL FIELDS RETURNING ${returning}`;
    const result = await searchSOSL(sosl);
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// ── Org Inspector ──────────────────────────────────────────────────────────

router.get("/org/health", authenticateToken, async (_req, res) => {
  try {
    const result = await getHealth();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/org/info", authenticateToken, async (_req, res) => {
  try {
    const result = await getOrgInfo();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/org/limits", authenticateToken, async (_req, res) => {
  try {
    const result = await getLimits();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/org/record-counts", authenticateToken, async (_req, res) => {
  try {
    const global = await describeGlobal();
    const countableObjects = global.sobjects
      .filter((o) => o.queryable && !o.name.endsWith("__History") && !o.name.endsWith("__Feed") && !o.name.endsWith("__Share"))
      .slice(0, 30);

    const counts: { name: string; label: string; count: number }[] = [];
    for (const obj of countableObjects) {
      try {
        const result = await runSOQL(`SELECT COUNT() FROM ${obj.name}`);
        counts.push({ name: obj.name, label: obj.label, count: (result as any).totalSize || 0 });
      } catch {
        counts.push({ name: obj.name, label: obj.label, count: -1 });
      }
    }

    counts.sort((a, b) => b.count - a.count);
    res.json({ counts });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

export default router;
