import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getLogs, getLogStats, addSSEClient, startWatching, loadInitialLogs } from "../services/logging";

const router = Router();

loadInitialLogs();
startWatching();

router.use(authenticateToken);

router.get("/", (req: Request, res: Response): void => {
  const source = req.query.source as string | undefined;
  const level = req.query.level as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Number(req.query.limit) || 200;
  const entries = getLogs({ source, level, search, limit });
  res.json(entries);
});

router.get("/stats", (_req: Request, res: Response): void => {
  res.json(getLogStats());
});

router.get("/stream", (req: Request, res: Response): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const remove = addSSEClient((entry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });

  req.on("close", () => { remove(); });
});

export default router;
