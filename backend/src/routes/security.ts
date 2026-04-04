import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { getDb } from "../db/schema";
import {
  getFieldRegistry,
  getEncryptionStatus,
  maskField,
  maskPayload,
  FIELD_CLASSIFICATIONS,
  type Sensitivity,
} from "../services/security";

const router = Router();

router.get("/fields", authenticateToken, (_req, res) => {
  const registry = getFieldRegistry();
  res.json({ fields: registry, total: registry.length });
});

router.get("/vault-audit", authenticateToken, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const db = getDb();

  const rows = db
    .query(
      "SELECT id, correlation_id, action, secret_key, user_id, ip_address, timestamp FROM vault_audit ORDER BY id DESC LIMIT ? OFFSET ?"
    )
    .all(limit, offset) as Array<{
    id: number;
    correlation_id: string;
    action: string;
    secret_key: string;
    user_id: string | null;
    ip_address: string | null;
    timestamp: string;
  }>;

  const countRow = db.query("SELECT COUNT(*) as total FROM vault_audit").get() as { total: number };

  res.json({ entries: rows, total: countRow.total, limit, offset });
});

router.post("/test-mask", authenticateToken, (req, res) => {
  const { payload, overrides } = req.body as {
    payload?: Record<string, unknown>;
    overrides?: Record<string, Sensitivity>;
  };

  if (!payload || typeof payload !== "object") {
    res.status(400).json({ error: "payload is required and must be an object" });
    return;
  }

  const masked = maskPayload(payload, overrides);

  const fieldDetails = Object.keys(payload).map((key) => {
    const original = typeof payload[key] === "string" ? payload[key] as string : String(payload[key]);
    const maskedVal = typeof masked[key] === "string" ? masked[key] as string : String(masked[key]);
    return {
      field: key,
      sensitivity: overrides?.[key] ?? (FIELD_CLASSIFICATIONS[key.toLowerCase()] || "public"),
      original: original.length > 20 ? original.slice(0, 20) + "..." : original,
      masked: maskedVal,
      wasMasked: original !== maskedVal,
    };
  });

  res.json({ masked, details: fieldDetails });
});

router.get("/status", authenticateToken, (_req, res) => {
  const encStatus = getEncryptionStatus();
  const db = getDb();

  const auditCount = db.query("SELECT COUNT(*) as total FROM vault_audit").get() as { total: number };
  const recentAudit = db
    .query("SELECT timestamp FROM vault_audit ORDER BY id DESC LIMIT 1")
    .get() as { timestamp: string } | null;

  res.json({
    encryption: encStatus,
    piiClassification: {
      enabled: true,
      totalFields: Object.keys(FIELD_CLASSIFICATIONS).length,
      piiFields: Object.entries(FIELD_CLASSIFICATIONS).filter(([, v]) => v === "pii").length,
      pciFields: Object.entries(FIELD_CLASSIFICATIONS).filter(([, v]) => v === "pci").length,
      secretFields: Object.entries(FIELD_CLASSIFICATIONS).filter(([, v]) => v === "secret").length,
    },
    vaultAudit: {
      enabled: true,
      totalEntries: auditCount.total,
      lastAccess: recentAudit?.timestamp || null,
    },
    correlationId: {
      enabled: true,
      headerName: "X-Correlation-Id",
      propagation: ["Express middleware", "Frontend API client", "Kafka message headers", "Mule correlationId"],
    },
  });
});

export default router;
