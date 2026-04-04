import fs from "fs";
import path from "path";
import type { Template, ScaffoldResult } from "./index";

export const helloWorldTemplate: Template = {
  metadata: {
    id: "hello-world",
    name: "Hello World API",
    description: "A simple MuleSoft 4 REST API with a /hello endpoint. Perfect for getting started.",
    requiredCredentials: ["anypoint"],
    ports: { "hello-world": 8081 },
    projects: ["${projectName}"],
  },

  async scaffold(basePath: string, projectName: string): Promise<ScaffoldResult> {
    const projectPath = path.join(basePath, projectName);
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });

    const srcMainMule = path.join(projectPath, "src/main/mule");
    const srcMainResources = path.join(projectPath, "src/main/resources");
    const srcMainResourcesApi = path.join(projectPath, "src/main/resources/api");
    const testsDir = path.join(projectPath, "tests");
    fs.mkdirSync(srcMainMule, { recursive: true });
    fs.mkdirSync(srcMainResourcesApi, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(
      path.join(srcMainMule, `${projectName}.xml`),
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
`
    );

    fs.writeFileSync(
      path.join(srcMainResourcesApi, `${projectName}.raml`),
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
`
    );

    const muleArtifactJson = JSON.stringify(
      { minMuleVersion: "4.11.0", classLoaderModelLoaderDescriptor: { id: "mule" } },
      null,
      2
    );
    fs.writeFileSync(path.join(srcMainResources, "mule-artifact.json"), muleArtifactJson);
    fs.writeFileSync(path.join(projectPath, "mule-artifact.json"), muleArtifactJson);

    fs.writeFileSync(
      path.join(projectPath, "pom.xml"),
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
`
    );

    fs.writeFileSync(path.join(projectPath, ".gitignore"), `target/\n.mule/\n*.jar\n*.class\n.DS_Store\n__pycache__/\n.pytest_cache/\n`);
    fs.writeFileSync(
      path.join(projectPath, "README.md"),
      `# ${projectName}\n\nA MuleSoft application scaffolded by Orca Community Edition.\n\n## API Endpoints\n\n- \`GET /api/hello\` - Returns a hello world message\n\n## Orca Community Edition\n`
    );

    fs.writeFileSync(
      path.join(testsDir, "test_hello.py"),
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
`
    );

    fs.writeFileSync(
      path.join(testsDir, "conftest.py"),
      `import pytest\n\n@pytest.fixture\ndef base_url():\n    return "http://localhost:8081"\n`
    );

    return {
      files: [
        `${projectName}/src/main/mule/${projectName}.xml`,
        `${projectName}/src/main/resources/api/${projectName}.raml`,
        `${projectName}/src/main/resources/mule-artifact.json`,
        `${projectName}/pom.xml`,
        `${projectName}/.gitignore`,
        `${projectName}/README.md`,
        `${projectName}/tests/test_hello.py`,
      ],
      projects: [projectName],
    };
  },
};
