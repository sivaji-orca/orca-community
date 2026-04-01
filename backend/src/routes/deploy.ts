import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getProjectPath } from "../services/git";
import { getMuleHome } from "../services/runtime";
import { deployToCloudHub, getCloudHubAppStatus, deleteCloudHubApp, getCloudHubRuntimes } from "../services/anypoint";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const router = Router();

router.use(authenticateToken);

function buildMuleJar(projectPath: string): string {
  if (!fs.existsSync(path.join(projectPath, "mule-artifact.json"))) {
    const srcArtifact = path.join(projectPath, "src/main/resources/mule-artifact.json");
    if (fs.existsSync(srcArtifact)) {
      fs.copyFileSync(srcArtifact, path.join(projectPath, "mule-artifact.json"));
    }
  }

  execSync("mvn clean package -DskipTests -q", {
    cwd: projectPath,
    timeout: 120000,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const targetDir = path.join(projectPath, "target");
  const jars = fs.readdirSync(targetDir).filter(f => f.endsWith("-mule-application.jar"));
  if (jars.length === 0) {
    throw new Error("Maven build succeeded but no Mule application JAR was produced");
  }

  return path.join(targetDir, jars[0]);
}

router.post("/local", (req: Request, res: Response): void => {
  try {
    const { projectName } = req.body;
    if (!projectName) {
      res.status(400).json({ error: "projectName is required" });
      return;
    }

    const projectPath = getProjectPath(projectName);
    if (!fs.existsSync(projectPath)) {
      res.status(404).json({ error: `Project '${projectName}' not found` });
      return;
    }

    const jarPath = buildMuleJar(projectPath);

    const muleAppsDir = path.join(getMuleHome(), "apps");
    if (!fs.existsSync(muleAppsDir)) {
      fs.mkdirSync(muleAppsDir, { recursive: true });
    }

    const deployJar = path.join(muleAppsDir, `${projectName}.jar`);
    if (fs.existsSync(deployJar)) fs.unlinkSync(deployJar);
    const explodedDir = path.join(muleAppsDir, projectName);
    if (fs.existsSync(explodedDir)) execSync(`rm -rf "${explodedDir}"`);

    fs.copyFileSync(jarPath, deployJar);

    res.json({
      message: `Project '${projectName}' built and deployed to local MuleSoft runtime`,
      deployPath: deployJar,
    });
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : "";
    res.status(500).json({
      error: `Deploy failed: ${err.message}`,
      details: stderr.split("\n").filter((l: string) => l.includes("[ERROR]")).join("\n"),
    });
  }
});

router.post("/cloudhub", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName, domain, environment, muleVersion, workerSize, workers, region } = req.body;
    if (!projectName) {
      res.status(400).json({ error: "projectName is required" });
      return;
    }

    const projectPath = getProjectPath(projectName);
    if (!fs.existsSync(projectPath)) {
      res.status(404).json({ error: `Project '${projectName}' not found` });
      return;
    }

    const jarPath = buildMuleJar(projectPath);

    const appDomain = domain || `orca-${projectName}`;

    const result = await deployToCloudHub({
      jarPath,
      domain: appDomain,
      environment,
      muleVersion,
      workerSize,
      workers,
      region,
    });

    res.json(result);
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : "";
    res.status(500).json({
      error: `CloudHub deploy failed: ${err.message}`,
      details: stderr,
    });
  }
});

router.get("/cloudhub/status/:domain", async (req: Request, res: Response): Promise<void> => {
  try {
    const { domain } = req.params;
    const environment = req.query.environment as string | undefined;
    const status = await getCloudHubAppStatus(domain, environment);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/cloudhub/:domain", async (req: Request, res: Response): Promise<void> => {
  try {
    const { domain } = req.params;
    const environment = req.query.environment as string | undefined;
    const message = await deleteCloudHubApp(domain, environment);
    res.json({ message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/cloudhub/runtimes", async (_req: Request, res: Response): Promise<void> => {
  try {
    const runtimes = await getCloudHubRuntimes();
    res.json(runtimes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
