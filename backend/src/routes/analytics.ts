import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getSummary, getTimeline, getRecentErrors, getEndpointBreakdown, recordMetric } from "../services/analytics";

const router = Router();
router.use(authenticateToken);

router.get("/summary", (req: Request, res: Response): void => {
  const project = req.query.project as string | undefined;
  const hours = Number(req.query.hours) || 24;
  res.json(getSummary(project, hours, req.workspaceId));
});

router.get("/timeline", (req: Request, res: Response): void => {
  const project = req.query.project as string | undefined;
  const hours = Number(req.query.hours) || 24;
  res.json(getTimeline(project, hours, req.workspaceId));
});

router.get("/errors", (req: Request, res: Response): void => {
  const project = req.query.project as string | undefined;
  const limit = Number(req.query.limit) || 50;
  res.json(getRecentErrors(project, limit, req.workspaceId));
});

router.get("/endpoints", (req: Request, res: Response): void => {
  const project = req.query.project as string | undefined;
  res.json(getEndpointBreakdown(project, req.workspaceId));
});

router.post("/record", (req: Request, res: Response): void => {
  const { endpoint, method, statusCode, responseTimeMs, projectName } = req.body;
  if (!endpoint || !method || !statusCode) {
    res.status(400).json({ error: "endpoint, method, and statusCode are required" }); return;
  }
  recordMetric(endpoint, method, statusCode, responseTimeMs || 0, projectName || "default", req.workspaceId);
  res.json({ message: "Metric recorded" });
});

export default router;
