import { Router, Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth";
import { listSecrets, getSecret, setSecret, deleteSecret } from "../services/vault";

const router = Router();

router.use(authenticateToken);
router.use(requireRole("administrator"));

router.get("/", (_req: Request, res: Response): void => {
  const secrets = listSecrets();
  res.json(secrets);
});

router.get("/list", (_req: Request, res: Response): void => {
  res.json(listSecrets());
});

router.get("/:key", (req: Request, res: Response): void => {
  const value = getSecret(req.params.key);
  if (value === null) {
    res.status(404).json({ error: "Secret not found" });
    return;
  }
  res.json({ key: req.params.key, value });
});

router.post("/", (req: Request, res: Response): void => {
  const { key, value, category } = req.body;
  if (!key || !value || !category) {
    res.status(400).json({ error: "key, value, and category are required" });
    return;
  }
  setSecret(key, value, category);
  res.status(201).json({ message: `Secret '${key}' saved` });
});

router.delete("/:key", (req: Request, res: Response): void => {
  const deleted = deleteSecret(req.params.key);
  if (!deleted) {
    res.status(404).json({ error: "Secret not found" });
    return;
  }
  res.json({ message: `Secret '${req.params.key}' deleted` });
});

export default router;
