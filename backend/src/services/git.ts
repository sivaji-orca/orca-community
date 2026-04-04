import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getSecret } from "./vault";

const ROOT_DIR = path.join(import.meta.dir, "../../..");
const WORKSPACES_DIR = path.join(ROOT_DIR, "workspaces");
const LEGACY_PROJECTS_DIR = path.join(ROOT_DIR, "projects");

export function migrateProjectsToWorkspaces(): void {
  if (!fs.existsSync(LEGACY_PROJECTS_DIR)) return;
  const entries = fs.readdirSync(LEGACY_PROJECTS_DIR);
  if (entries.length === 0) return;

  const defaultProjectsDir = path.join(WORKSPACES_DIR, "Default", "projects");
  fs.mkdirSync(defaultProjectsDir, { recursive: true });

  for (const entry of entries) {
    const src = path.join(LEGACY_PROJECTS_DIR, entry);
    const dest = path.join(defaultProjectsDir, entry);
    if (fs.statSync(src).isDirectory() && !fs.existsSync(dest)) {
      fs.renameSync(src, dest);
    }
  }
  const remaining = fs.readdirSync(LEGACY_PROJECTS_DIR);
  if (remaining.length === 0) {
    fs.rmdirSync(LEGACY_PROJECTS_DIR);
  }
}

function getWorkspaceProjectsDir(workspaceName: string): string {
  return path.join(WORKSPACES_DIR, workspaceName, "projects");
}

function ensureProjectsDir(workspaceName: string): void {
  const dir = getWorkspaceProjectsDir(workspaceName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, timeout: 30000 }).toString().trim();
}

export function getWorkspacePath(workspaceName = "Default"): string {
  const dir = getWorkspaceProjectsDir(workspaceName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getProjectPath(projectName: string, workspaceName = "Default"): string {
  return path.join(getWorkspaceProjectsDir(workspaceName), projectName);
}

export function listProjects(workspaceName = "Default"): string[] {
  const dir = getWorkspaceProjectsDir(workspaceName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory());
}

export function initRepo(projectName: string, workspaceName = "Default"): string {
  ensureProjectsDir(workspaceName);
  const projectPath = getProjectPath(projectName, workspaceName);
  if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
  run("git init", projectPath);
  run("git branch -M main", projectPath);
  return projectPath;
}

export async function createRemoteRepo(projectName: string, workspaceName = "Default"): Promise<string> {
  const token = getSecret("github_token");
  const org = getSecret("github_org");
  if (!token) throw new Error("GitHub token not configured. Add it in Admin > Secrets.");

  const url = org ? `https://api.github.com/orgs/${org}/repos` : "https://api.github.com/user/repos";
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ name: projectName, private: true, auto_init: false }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GitHub repo creation failed: ${resp.status} ${body}`);
  }

  const data = (await resp.json()) as any;
  const projectPath = getProjectPath(projectName, workspaceName);
  const remoteUrl = `https://${token}@github.com/${data.full_name}.git`;
  run(`git remote add origin "${remoteUrl}"`, projectPath);
  return data.html_url;
}

export function commitChanges(projectName: string, message: string, workspaceName = "Default"): string {
  const p = getProjectPath(projectName, workspaceName);
  run("git add -A", p);
  run(`git commit -m "${message}"`, p);
  return run("git rev-parse HEAD", p);
}

export function pushToRemote(projectName: string, branch?: string, workspaceName = "Default"): void {
  const p = getProjectPath(projectName, workspaceName);
  const b = branch || getCurrentBranch(projectName, workspaceName);
  run(`git push -u origin ${b}`, p);
}

export function getGitStatus(projectName: string, workspaceName = "Default"): string {
  const p = getProjectPath(projectName, workspaceName);
  if (!fs.existsSync(p)) return "Project not found";
  return run("git status --short", p);
}

export function getGitLog(projectName: string, limit = 20, workspaceName = "Default"): Array<{ hash: string; message: string; author: string; date: string }> {
  const p = getProjectPath(projectName, workspaceName);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = run(`git log --format="%H|||%s|||%an|||%ai" -${limit}`, p);
    if (!raw) return [];
    return raw.split("\n").filter(Boolean).map((line) => {
      const [hash, message, author, date] = line.split("|||");
      return { hash: hash.slice(0, 8), message, author, date };
    });
  } catch {
    return [];
  }
}

export function listBranches(projectName: string, workspaceName = "Default"): { branches: string[]; current: string } {
  const p = getProjectPath(projectName, workspaceName);
  const raw = run("git branch -a", p);
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  let current = "main";
  const branches = lines.map((l) => {
    if (l.startsWith("* ")) {
      current = l.replace("* ", "");
      return current;
    }
    return l;
  });
  return { branches, current };
}

export function getCurrentBranch(projectName: string, workspaceName = "Default"): string {
  const p = getProjectPath(projectName, workspaceName);
  return run("git rev-parse --abbrev-ref HEAD", p);
}

export function createBranch(projectName: string, branchName: string, workspaceName = "Default"): void {
  const p = getProjectPath(projectName, workspaceName);
  run(`git checkout -b ${branchName}`, p);
}

export function switchBranch(projectName: string, branchName: string, workspaceName = "Default"): void {
  const p = getProjectPath(projectName, workspaceName);
  run(`git checkout ${branchName}`, p);
}

export function mergeBranch(projectName: string, sourceBranch: string, workspaceName = "Default"): { success: boolean; conflicts: string[] } {
  const p = getProjectPath(projectName, workspaceName);
  try {
    run(`git merge ${sourceBranch}`, p);
    return { success: true, conflicts: [] };
  } catch (err: any) {
    const conflicts = getMergeConflicts(projectName, workspaceName);
    if (conflicts.length > 0) return { success: false, conflicts };
    throw err;
  }
}

export function getMergeConflicts(projectName: string, workspaceName = "Default"): string[] {
  const p = getProjectPath(projectName, workspaceName);
  try {
    const raw = run("git diff --name-only --diff-filter=U", p);
    return raw ? raw.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function resolveConflict(projectName: string, filePath: string, resolution: "ours" | "theirs", workspaceName = "Default"): void {
  const p = getProjectPath(projectName, workspaceName);
  run(`git checkout --${resolution} "${filePath}"`, p);
  run(`git add "${filePath}"`, p);
}

export function getDiff(projectName: string, cached = false, workspaceName = "Default"): string {
  const p = getProjectPath(projectName, workspaceName);
  return run(`git diff${cached ? " --cached" : ""}`, p);
}

export function pullFromRemote(projectName: string, workspaceName = "Default"): string {
  const p = getProjectPath(projectName, workspaceName);
  return run("git pull origin " + getCurrentBranch(projectName, workspaceName), p);
}

export async function createPullRequest(projectName: string, title: string, body: string, head: string, base = "main", workspaceName = "Default"): Promise<string> {
  const token = getSecret("github_token");
  if (!token) throw new Error("GitHub token not configured.");

  const p = getProjectPath(projectName, workspaceName);
  const remoteUrl = run("git remote get-url origin", p);
  const match = remoteUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
  if (!match) throw new Error("Could not determine GitHub repo from remote URL");
  const repo = match[1].replace(/\.git$/, "");

  const resp = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ title, body, head, base }),
  });

  if (!resp.ok) throw new Error(`PR creation failed: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as any;
  return data.html_url;
}
