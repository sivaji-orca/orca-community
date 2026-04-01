import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getProjectPath, getCurrentBranch, getGitLog, getGitStatus } from "../services/git";
import { syncProjectToPostman, getWorkspaceStatus } from "../services/postman";
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

router.post("/scaffold", async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName } = req.body;
    if (!projectName) { res.status(400).json({ error: "projectName is required" }); return; }

    const projectPath = getProjectPath(projectName);
    if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length > 0) {
      res.status(409).json({ error: `Project '${projectName}' already exists and is not empty` });
      return;
    }
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });

    const srcMainMule = path.join(projectPath, "src/main/mule");
    const srcMainResources = path.join(projectPath, "src/main/resources");
    const srcMainResourcesApi = path.join(projectPath, "src/main/resources/api");
    const testsDir = path.join(projectPath, "tests");
    fs.mkdirSync(srcMainMule, { recursive: true });
    fs.mkdirSync(srcMainResourcesApi, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(path.join(srcMainMule, `${projectName}.xml`),
`<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/http http://www.mulesoft.org/schema/mule/http/current/mule-http.xsd">

    <http:listener-config name="HTTP_Listener_config">
        <http:listener-connection host="0.0.0.0" port="8081" />
    </http:listener-config>

    <flow name="${projectName}-hello-flow">
        <http:listener config-ref="HTTP_Listener_config" path="/api/hello" />
        <set-payload value='{"message": "Hello World from ${projectName}!"}' mimeType="application/json" />
    </flow>
</mule>
`);

    fs.writeFileSync(path.join(srcMainResourcesApi, `${projectName}.raml`),
`#%RAML 1.0
title: ${projectName} API
version: v1
baseUri: http://localhost:8081/api

/hello:
  get:
    description: Returns a hello world message
    queryParameters:
      name:
        type: string
        required: false
        default: World
    responses:
      200:
        body:
          application/json:
            example: |
              {"message": "Hello World from ${projectName}!"}
`);

    const muleArtifactJson = JSON.stringify({ minMuleVersion: "4.11.0", classLoaderModelLoaderDescriptor: { id: "mule" } }, null, 2);
    fs.writeFileSync(path.join(srcMainResources, "mule-artifact.json"), muleArtifactJson);
    fs.writeFileSync(path.join(projectPath, "mule-artifact.json"), muleArtifactJson);

    fs.writeFileSync(path.join(projectPath, "pom.xml"),
`<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.orcaesb</groupId>
    <artifactId>${projectName}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>mule-application</packaging>
    <name>${projectName}</name>
    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <mule.maven.plugin.version>4.3.0</mule.maven.plugin.version>
    </properties>
    <build>
        <plugins>
            <plugin>
                <groupId>org.mule.tools.maven</groupId>
                <artifactId>mule-maven-plugin</artifactId>
                <version>\${mule.maven.plugin.version}</version>
                <extensions>true</extensions>
                <configuration>
                    <classifier>mule-application</classifier>
                </configuration>
            </plugin>
        </plugins>
    </build>
    <dependencies>
        <dependency>
            <groupId>org.mule.connectors</groupId>
            <artifactId>mule-http-connector</artifactId>
            <version>1.10.4</version>
            <classifier>mule-plugin</classifier>
        </dependency>
    </dependencies>
    <repositories>
        <repository>
            <id>anypoint-exchange-v3</id>
            <name>Anypoint Exchange</name>
            <url>https://maven.anypoint.mulesoft.com/api/v3/maven</url>
        </repository>
        <repository>
            <id>mulesoft-releases</id>
            <name>MuleSoft Releases</name>
            <url>https://repository.mulesoft.org/releases/</url>
        </repository>
    </repositories>
    <pluginRepositories>
        <pluginRepository>
            <id>mulesoft-releases</id>
            <name>MuleSoft Releases</name>
            <url>https://repository.mulesoft.org/releases/</url>
        </pluginRepository>
    </pluginRepositories>
</project>
`);

    fs.writeFileSync(path.join(projectPath, ".gitignore"), `target/\n.mule/\n*.jar\n*.class\n.DS_Store\n__pycache__/\n.pytest_cache/\n`);
    fs.writeFileSync(path.join(projectPath, "README.md"),
`# ${projectName}\n\nA MuleSoft application scaffolded by Orca Community Edition.\n\n## API Endpoints\n\n- \`GET /api/hello\` - Returns a hello world message\n\n## Orca Community Edition\n`);

    fs.writeFileSync(path.join(testsDir, `test_hello.py`),
`import requests
import pytest

BASE_URL = "http://localhost:8081"

class TestHelloApi:
    def test_get_hello_returns_200(self):
        resp = requests.get(f"{BASE_URL}/api/hello")
        assert resp.status_code == 200

    def test_response_is_json(self):
        resp = requests.get(f"{BASE_URL}/api/hello")
        assert "application/json" in resp.headers.get("Content-Type", "")

    def test_response_has_message(self):
        resp = requests.get(f"{BASE_URL}/api/hello")
        data = resp.json()
        assert "message" in data
`);

    fs.writeFileSync(path.join(testsDir, "conftest.py"), `import pytest\n\n@pytest.fixture\ndef base_url():\n    return "http://localhost:8081"\n`);

    let postmanSync: string | null = null;
    if (getWorkspaceStatus().connected) {
      try {
        const result = await syncProjectToPostman(projectName);
        postmanSync = `Collection ${result.action} in Postman`;
      } catch { /* non-blocking */ }
    }

    res.status(201).json({
      message: `Project '${projectName}' scaffolded successfully`,
      path: projectPath,
      postmanSync,
      files: [`src/main/mule/${projectName}.xml`, `src/main/resources/api/${projectName}.raml`, "src/main/resources/mule-artifact.json", "pom.xml", ".gitignore", "README.md", "tests/test_hello.py"],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/list", (_req: Request, res: Response): void => {
  const projectsDir = path.join(import.meta.dir, "../../../projects");
  if (!fs.existsSync(projectsDir)) { res.json([]); return; }
  const projects = fs.readdirSync(projectsDir).filter((f) => fs.statSync(path.join(projectsDir, f)).isDirectory());
  res.json(projects);
});

router.get("/:name/tree", (req: Request, res: Response): void => {
  const projectPath = getProjectPath(req.params.name);
  if (!fs.existsSync(projectPath)) { res.status(404).json({ error: "Project not found" }); return; }
  res.json(buildTree(projectPath));
});

router.get("/:name/file", (req: Request, res: Response): void => {
  const filePath = req.query.path as string;
  if (!filePath) { res.status(400).json({ error: "path query param required" }); return; }
  const fullPath = path.join(getProjectPath(req.params.name), filePath);
  if (!fs.existsSync(fullPath)) { res.status(404).json({ error: "File not found" }); return; }
  const content = fs.readFileSync(fullPath, "utf8");
  res.json({ path: filePath, content });
});

router.get("/:name/info", (req: Request, res: Response): void => {
  const projectPath = getProjectPath(req.params.name);
  if (!fs.existsSync(projectPath)) { res.status(404).json({ error: "Project not found" }); return; }
  try {
    const branch = getCurrentBranch(req.params.name);
    const log = getGitLog(req.params.name, 1);
    const status = getGitStatus(req.params.name);
    res.json({ name: req.params.name, branch, lastCommit: log[0] || null, status, path: projectPath });
  } catch {
    res.json({ name: req.params.name, branch: "unknown", lastCommit: null, status: "", path: projectPath });
  }
});

export default router;
