import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  startAll,
  stopAll,
  startMule,
  stopMule,
  startWiremock,
  stopWiremock,
  getServiceStatus,
  getSetupStatus,
  getMuleLogs,
} from "../services/runtime";

const router = Router();

router.use(authenticateToken);

router.get("/setup-status", (_req: Request, res: Response): void => {
  const status = getSetupStatus();
  res.json(status);
});

router.post("/start", (_req: Request, res: Response): void => {
  try {
    const messages = startAll();
    res.json({ message: "Services started", details: messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/stop", (_req: Request, res: Response): void => {
  try {
    const messages = stopAll();
    res.json({ message: "Services stopped", details: messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/start/mule", (_req: Request, res: Response): void => {
  try {
    const msg = startMule();
    res.json({ message: msg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/stop/mule", (_req: Request, res: Response): void => {
  try {
    const msg = stopMule();
    res.json({ message: msg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/start/wiremock", (_req: Request, res: Response): void => {
  try {
    const msg = startWiremock();
    res.json({ message: msg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/stop/wiremock", (_req: Request, res: Response): void => {
  try {
    const msg = stopWiremock();
    res.json({ message: msg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/status", (_req: Request, res: Response): void => {
  try {
    const services = getServiceStatus();
    res.json(services);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/logs/mule", (req: Request, res: Response): void => {
  const lines = Number(req.query.lines) || 50;
  const logs = getMuleLogs(lines);
  res.json({ logs });
});

export default router;
