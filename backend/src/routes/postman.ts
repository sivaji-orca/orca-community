import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  generateCollection, importToPostman, listCollections,
  getOrCreateWorkspace, getWorkspaceStatus, syncProjectToPostman,
  syncAllProjects, getSyncStatus, removeProjectFromPostman, getCollection,
  syncEnvironment, listEnvironments, getEnvironmentDetail,
} from "../services/postman";

const router = Router();
router.use(authenticateToken);

router.post("/generate", (req: Request, res: Response): void => {
  try {
    const { projectName, basePath } = req.body;
    if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }
    const collection = generateCollection(projectName, basePath);
    res.json({ message: "Collection generated", collection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/import", async (req: Request, res: Response): Promise<void> => {
  try {
    const { collection } = req.body;
    if (!collection) { res.status(400).json({ error: "collection is required" }); return; }
    const result = await importToPostman(collection);
    res.json({ message: "Collection imported to Postman", result });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/collections", async (_req: Request, res: Response): Promise<void> => {
  try {
    const collections = await listCollections();
    res.json(collections);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/workspace", async (_req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await getOrCreateWorkspace();
    res.json({ message: "Workspace ready", ...workspace });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/workspace", (_req: Request, res: Response): void => {
  res.json(getWorkspaceStatus());
});

router.post("/sync/:projectName", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await syncProjectToPostman(req.params.projectName);
    res.json({ message: `Collection ${result.action} in Postman`, ...result });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/sync-all", async (_req: Request, res: Response): Promise<void> => {
  try {
    const results = await syncAllProjects();
    res.json({ message: `Synced ${results.length} projects`, results });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/sync-status", (_req: Request, res: Response): void => {
  res.json(getSyncStatus());
});

router.delete("/collection/:projectName", async (req: Request, res: Response): Promise<void> => {
  try {
    await removeProjectFromPostman(req.params.projectName);
    res.json({ message: `Collection for '${req.params.projectName}' removed from Postman` });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/collection/:projectName", async (req: Request, res: Response): Promise<void> => {
  try {
    const status = getSyncStatus().find((s) => s.projectName === req.params.projectName);
    if (!status?.collectionUid) { res.status(404).json({ error: "Project not synced to Postman" }); return; }
    const data = await getCollection(status.collectionUid);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/environment", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, values } = req.body;
    if (!name || !values) { res.status(400).json({ error: "name and values are required" }); return; }
    const result = await syncEnvironment(name, values);
    res.json({ message: `Environment '${name}' ${result.action} in Postman`, ...result });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/environments", async (_req: Request, res: Response): Promise<void> => {
  try {
    const envs = await listEnvironments();
    res.json(envs);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/environment/:uid", async (req: Request, res: Response): Promise<void> => {
  try {
    const detail = await getEnvironmentDetail(req.params.uid);
    res.json(detail);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
