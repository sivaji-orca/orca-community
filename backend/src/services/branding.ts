import { getDb } from "../db/schema";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { getSecret } from "./vault";

const ROOT_DIR = path.join(import.meta.dir, "../../..");

interface Branding {
  appName: string;
  appShortName: string;
  description: string;
  logoSvg: string | null;
  repoName: string | null;
  forkedAt: string | null;
}

const DEFAULT_BRANDING: Branding = {
  appName: "Orca Community Edition",
  appShortName: "Orca",
  description: "MuleSoft Developer Productivity Tool",
  logoSvg: null,
  repoName: null,
  forkedAt: null,
};

export function getBranding(): Branding {
  const db = getDb();
  const row = db.query("SELECT * FROM branding WHERE id = 1").get() as {
    app_name: string;
    app_short_name: string;
    description: string;
    logo_svg: string | null;
    repo_name: string | null;
    forked_at: string | null;
  } | null;

  if (!row) return DEFAULT_BRANDING;
  return {
    appName: row.app_name,
    appShortName: row.app_short_name,
    description: row.description,
    logoSvg: row.logo_svg,
    repoName: row.repo_name,
    forkedAt: row.forked_at,
  };
}

export function setBranding(
  appName: string,
  description: string,
  logoSvg?: string | null
): Branding {
  const db = getDb();
  const shortName = appName.split(/\s+/)[0] || appName;
  const existing = db.query("SELECT id FROM branding WHERE id = 1").get();

  if (existing) {
    db.run(
      "UPDATE branding SET app_name = ?, app_short_name = ?, description = ?, logo_svg = ? WHERE id = 1",
      [appName, shortName, description, logoSvg ?? generateDefaultAvatar(shortName)]
    );
  } else {
    db.run(
      "INSERT INTO branding (id, app_name, app_short_name, description, logo_svg) VALUES (1, ?, ?, ?, ?)",
      [appName, shortName, description, logoSvg ?? generateDefaultAvatar(shortName)]
    );
  }
  return getBranding();
}

export function generateDefaultAvatar(appName: string): string {
  const letter = (appName[0] || "O").toUpperCase();
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='currentColor'/><text x='16' y='23' text-anchor='middle' fill='white' font-size='20' font-weight='bold'>${letter}</text></svg>`;
}

const BRAND_REPLACEMENTS: Array<{ file: string; patterns: Array<[RegExp, (name: string, desc: string) => string]> }> = [
  {
    file: "frontend/index.html",
    patterns: [
      [/<title>Orca Community Edition<\/title>/, (name) => `<title>${name}</title>`],
      [/font-weight='bold'>O</, (name) => `font-weight='bold'>${name[0]?.toUpperCase() || "O"}<`],
    ],
  },
  {
    file: "frontend/src/pages/Login.tsx",
    patterns: [
      [/>O<\/span>/, (name) => `>${name[0]?.toUpperCase() || "O"}</span>`],
      [/>Orca<\/h1>/, (name) => `>${name.split(/\s+/)[0]}</h1>`],
      [/>MuleSoft Developer Productivity Tool</, (_, desc) => `>${desc}<`],
      [/>Community Edition</, () => `><`],
    ],
  },
  {
    file: "frontend/src/components/Layout.tsx",
    patterns: [
      [/>O<\/span>/, (name) => `>${name[0]?.toUpperCase() || "O"}</span>`],
      [/>Orca Community<\/h1>/, (name) => `>${name.split(/\s+/)[0]}</h1>`],
      [/Orca Community Edition/, (name) => name],
    ],
  },
  {
    file: "backend/package.json",
    patterns: [
      [/"orca-community-backend"/, (name) => `"${name.toLowerCase().replace(/\s+/g, "-")}-backend"`],
    ],
  },
  {
    file: "README.md",
    patterns: [
      [/# Orca Community Edition/, (name) => `# ${name}`],
    ],
  },
];

export interface ForkResult {
  repoPath: string;
  repoName: string;
  repoUrl: string | null;
}

export async function forkAndBrand(
  appName: string,
  description: string,
  targetDir?: string
): Promise<ForkResult> {
  const repoName = `${appName.toLowerCase().replace(/\s+/g, "-")}-orca`;
  const repoPath = targetDir || path.join(path.dirname(ROOT_DIR), repoName);

  if (fs.existsSync(repoPath)) {
    throw new Error(`Directory already exists: ${repoPath}`);
  }

  fs.mkdirSync(repoPath, { recursive: true });

  const excludes = ["node_modules", ".git", "data", "dist", "workspaces", ".cursor"];
  const entries = fs.readdirSync(ROOT_DIR);
  for (const entry of entries) {
    if (excludes.includes(entry)) continue;
    const src = path.join(ROOT_DIR, entry);
    const dest = path.join(repoPath, entry);
    fs.cpSync(src, dest, { recursive: true });
  }

  for (const item of BRAND_REPLACEMENTS) {
    const filePath = path.join(repoPath, item.file);
    if (!fs.existsSync(filePath)) continue;
    let content = fs.readFileSync(filePath, "utf8");
    for (const [regex, replacer] of item.patterns) {
      content = content.replace(regex, replacer(appName, description));
    }
    fs.writeFileSync(filePath, content, "utf8");
  }

  try {
    execSync("git init && git branch -M main", { cwd: repoPath, timeout: 10000 });
    const upstreamUrl = getOriginUrl();
    if (upstreamUrl) {
      execSync(`git remote add upstream ${upstreamUrl}`, { cwd: repoPath, timeout: 5000 });
    }
  } catch { /* git init is best-effort */ }

  let repoUrl: string | null = null;
  const token = getSecret("github_token");

  if (token) {
    try {
      const ghResult = await createGithubRepo(repoName, description, token);
      const remoteUrl = `https://${token}@github.com/${ghResult.fullName}.git`;
      execSync(`git remote add origin "${remoteUrl}"`, { cwd: repoPath, timeout: 5000 });
      execSync('git add -A && git commit -m "Initial branded fork from Orca Community Edition"', { cwd: repoPath, timeout: 15000 });
      execSync("git push -u origin main", { cwd: repoPath, timeout: 30000 });
      repoUrl = ghResult.htmlUrl;

      await protectBranch(ghResult.fullName, "main", token);
    } catch { /* remote creation is best-effort */ }
  }

  const db = getDb();
  db.run("UPDATE branding SET repo_name = ?, forked_at = datetime('now') WHERE id = 1", [repoName]);

  return { repoPath, repoName, repoUrl };
}

function getOriginUrl(): string | null {
  try {
    return execSync("git remote get-url origin", { cwd: ROOT_DIR, timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
}

async function createGithubRepo(
  name: string,
  description: string,
  token: string
): Promise<{ fullName: string; htmlUrl: string }> {
  let org: string | null = null;
  try { org = getSecret("github_org"); } catch { /* no org configured */ }

  const url = org
    ? `https://api.github.com/orgs/${org}/repos`
    : "https://api.github.com/user/repos";

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ name, description, private: true, auto_init: false }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GitHub repo creation failed: ${resp.status} ${body}`);
  }

  const data = (await resp.json()) as any;
  return { fullName: data.full_name, htmlUrl: data.html_url };
}

async function protectBranch(fullName: string, branch: string, token: string): Promise<void> {
  const url = `https://api.github.com/repos/${fullName}/branches/${branch}/protection`;
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      required_pull_request_reviews: { required_approving_review_count: 1 },
      enforce_admins: false,
      required_status_checks: null,
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
    }),
  });
}
