import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  initRepo, createRemoteRepo, commitChanges, pushToRemote, getGitStatus, getGitLog,
  listBranches, createBranch, switchBranch, mergeBranch, getMergeConflicts,
  resolveConflict, getDiff, pullFromRemote, createPullRequest,
} from "../services/git";

const router = Router();
router.use(authenticateToken);

router.post("/init", (req: Request, res: Response): void => {
  try {
    const { projectName } = req.body;
    if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }
    const p = initRepo(projectName);
    res.json({ message: "Git repository initialized", path: p });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/create-remote", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName } = req.body;
    if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }
    const url = await createRemoteRepo(projectName);
    res.json({ message: "Remote repository created", url });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/commit", (req: Request, res: Response): void => {
  try {
    const { projectName, message } = req.body;
    if (!projectName || !message) { res.status(400).json({ error: "projectName and message are required" }); return; }
    const hash = commitChanges(projectName, message);
    res.json({ message: "Changes committed", hash });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/push", (req: Request, res: Response): void => {
  try {
    const { projectName, branch } = req.body;
    if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }
    pushToRemote(projectName, branch);
    res.json({ message: "Pushed to remote" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/status/:projectName", (req: Request, res: Response): void => {
  res.json({ status: getGitStatus(req.params.projectName) });
});

router.get("/log/:projectName", (req: Request, res: Response): void => {
  const limit = Number(req.query.limit) || 20;
  res.json(getGitLog(req.params.projectName, limit));
});

router.get("/branches/:projectName", (req: Request, res: Response): void => {
  try {
    res.json(listBranches(req.params.projectName));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/branch", (req: Request, res: Response): void => {
  try {
    const { projectName, branchName } = req.body;
    if (!projectName || !branchName) { res.status(400).json({ error: "projectName and branchName are required" }); return; }
    createBranch(projectName, branchName);
    res.json({ message: `Branch '${branchName}' created` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/checkout", (req: Request, res: Response): void => {
  try {
    const { projectName, branchName } = req.body;
    if (!projectName || !branchName) { res.status(400).json({ error: "projectName and branchName are required" }); return; }
    switchBranch(projectName, branchName);
    res.json({ message: `Switched to '${branchName}'` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/merge", (req: Request, res: Response): void => {
  try {
    const { projectName, sourceBranch } = req.body;
    if (!projectName || !sourceBranch) { res.status(400).json({ error: "projectName and sourceBranch are required" }); return; }
    const result = mergeBranch(projectName, sourceBranch);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/conflicts/:projectName", (req: Request, res: Response): void => {
  res.json({ conflicts: getMergeConflicts(req.params.projectName) });
});

router.post("/resolve-conflict", (req: Request, res: Response): void => {
  try {
    const { projectName, filePath, resolution } = req.body;
    if (!projectName || !filePath || !resolution) {
      res.status(400).json({ error: "projectName, filePath, and resolution (ours|theirs) are required" }); return;
    }
    resolveConflict(projectName, filePath, resolution);
    res.json({ message: `Conflict in '${filePath}' resolved with '${resolution}'` });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/diff/:projectName", (req: Request, res: Response): void => {
  try {
    const cached = req.query.cached === "true";
    res.json({ diff: getDiff(req.params.projectName, cached) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/pull", (req: Request, res: Response): void => {
  try {
    const { projectName } = req.body;
    if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }
    const output = pullFromRemote(projectName);
    res.json({ message: "Pulled from remote", output });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/pull-request", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName, title, body, head, base } = req.body;
    if (!projectName || !title || !head) {
      res.status(400).json({ error: "projectName, title, and head are required" }); return;
    }
    const url = await createPullRequest(projectName, title, body || "", head, base);
    res.json({ message: "Pull request created", url });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
