import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getApplications, getEnvironments, getApiContracts } from "../services/anypoint";

const router = Router();

router.use(authenticateToken);

router.get("/applications", async (_req: Request, res: Response): Promise<void> => {
  try {
    const apps = await getApplications();
    res.json(apps);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/environments", async (_req: Request, res: Response): Promise<void> => {
  try {
    const envs = await getEnvironments();
    res.json(envs);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/api-contracts", async (_req: Request, res: Response): Promise<void> => {
  try {
    const contracts = await getApiContracts();
    res.json(contracts);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
