import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  getOrgInfo,
  getHealth,
  queryAccounts,
  runSOQL,
} from "../services/salesforce";

const router = Router();

router.get("/health", authenticateToken, async (_req, res) => {
  try {
    const result = await getHealth();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/org", authenticateToken, async (_req, res) => {
  try {
    const result = await getOrgInfo();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.get("/accounts", authenticateToken, async (_req, res) => {
  try {
    const result = await queryAccounts();
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

router.post("/query", authenticateToken, async (req, res) => {
  try {
    const { soql } = req.body;
    if (!soql) {
      res.status(400).json({ error: "soql is required" });
      return;
    }
    const result = await runSOQL(soql);
    res.json(result);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

export default router;
