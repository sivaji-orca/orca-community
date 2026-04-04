import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getProjectPath, getCurrentBranch, getGitLog, getGitStatus, listProjects, getWorkspacePath } from "../services/git";
import { syncProjectToPostman, getWorkspaceStatus } from "../services/postman";
import { templateRegistry, getTemplateList } from "../templates/index";
import fs from "fs";
import path from "path";

const router = Router();
router.use(authenticateToken);

function buildTree(dirPath: string, basePath = ""): any[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: any[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const rel = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: rel, type: "directory", children: buildTree(path.join(dirPath, entry.name), rel) });
    } else {
      const stat = fs.statSync(path.join(dirPath, entry.name));
      result.push({ name: entry.name, path: rel, type: "file", size: stat.size });
    }
  }
  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

router.get("/templates", (_req: Request, res: Response): void => {
  res.json(getTemplateList());
});

router.post("/scaffold", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName, template = "hello-world" } = req.body;
    if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }

    const tmpl = templateRegistry[template];
    if (!tmpl) { res.status(400).json({ error: `Unknown template: ${template}` }); return; }

    const wsName = req.workspaceName;
    const basePath = getWorkspacePath(wsName);

    const firstProject = tmpl.metadata.projects[0]?.replace("${projectName}", projectName) || projectName;
    const firstProjectPath = path.join(basePath, firstProject);
    if (fs.existsSync(firstProjectPath) && fs.readdirSync(firstProjectPath).length > 0) {
      res.status(409).json({ error: `Project '${firstProject}' already exists and is not empty` });
      return;
    }

    const result = await tmpl.scaffold(basePath, projectName);

    let postmanSync: string | null = null;
    if (getWorkspaceStatus().connected) {
      try {
        const syncResult = await syncProjectToPostman(projectName);
        postmanSync = `Collection ${syncResult.action} in Postman`;
      } catch { /* non-blocking */ }
    }

    res.status(201).json({
      message: `Project '${projectName}' scaffolded with template '${template}'`,
      template,
      projects: result.projects,
      postmanSync,
      files: result.files,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/list", (req: Request, res: Response): void => {
  res.json(listProjects(req.workspaceName));
});

router.get("/:name/tree", (req: Request, res: Response): void => {
  const projectPath = getProjectPath(req.params.name, req.workspaceName);
  if (!fs.existsSync(projectPath)) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(buildTree(projectPath));
});

router.get("/:name/file", (req: Request, res: Response): void => {
  const filePath = req.query.path as string;
  if (!filePath) { res.status(400).json({ error: "path query param required" }); return; }
  const fullPath = path.join(getProjectPath(req.params.name, req.workspaceName), filePath);
  if (!fs.existsSync(fullPath)) { res.status(404).json({ error: "File not found" }); return; }
  const content = fs.readFileSync(fullPath, "utf8");
  res.json({ path: filePath, content });
});

router.get("/:name/info", (req: Request, res: Response): void => {
  const wsName = req.workspaceName;
  const projectPath = getProjectPath(req.params.name, wsName);
  if (!fs.existsSync(projectPath)) { res.status(404).json({ error: "Project not found" }); return; }
  try {
    const branch = getCurrentBranch(req.params.name, wsName);
    const log = getGitLog(req.params.name, 1, wsName);
    const status = getGitStatus(req.params.name, wsName);
    res.json({ name: req.params.name, branch, lastCommit: log[0] || null, status, path: projectPath });
  } catch {
    res.json({ name: req.params.name, branch: "unknown", lastCommit: null, status: "", path: projectPath });
  }
});

export default router;
