import express from "express";
import cors from "cors";
import type { Server } from "http";

import systemRoutes from "../../routes/system";
import authRoutes from "../../routes/auth";
import workspacesRoutes from "../../routes/workspaces";
import teamRoutes from "../../routes/team";
import secretsRoutes from "../../routes/secrets";
import anypointRoutes from "../../routes/anypoint";
import gitRoutes from "../../routes/git";
import runtimeRoutes from "../../routes/runtime";
import postmanRoutes from "../../routes/postman";
import projectsRoutes from "../../routes/projects";
import deployRoutes from "../../routes/deploy";
import loggingRoutes from "../../routes/logging";
import analyticsRoutes from "../../routes/analytics";
import salesforceRoutes from "../../routes/salesforce";
import securityRoutes from "../../routes/security";
import brandingRoutes from "../../routes/branding";
import scannerRoutes from "../../routes/scanner";
import dataweaveRoutes from "../../routes/dataweave";
import sfDevtoolsRoutes from "../../routes/sf-devtools";
import { resolveWorkspace } from "../../middleware/auth";
import { correlationId, requestLogger } from "../../middleware/correlationId";

export interface TestContext {
  baseUrl: string;
  server: Server;
  cleanup: () => Promise<void>;
}

export async function startTestServer(): Promise<TestContext> {
  const app = express();

  app.use(cors());
  app.use(correlationId);
  app.use(express.json({ limit: "10mb" }));
  app.use(requestLogger);
  app.use(resolveWorkspace);

  app.use("/api/system", systemRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/workspaces", workspacesRoutes);
  app.use("/api/team", teamRoutes);
  app.use("/api/secrets", secretsRoutes);
  app.use("/api/anypoint", anypointRoutes);
  app.use("/api/git", gitRoutes);
  app.use("/api/runtime", runtimeRoutes);
  app.use("/api/postman", postmanRoutes);
  app.use("/api/projects", projectsRoutes);
  app.use("/api/deploy", deployRoutes);
  app.use("/api/logs", loggingRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/salesforce", salesforceRoutes);
  app.use("/api/security", securityRoutes);
  app.use("/api/branding", brandingRoutes);
  app.use("/api/scanner", scannerRoutes);
  app.use("/api/dataweave", dataweaveRoutes);
  app.use("/api/sf-devtools", sfDevtoolsRoutes);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const baseUrl = `http://localhost:${port}`;

      const cleanup = () =>
        new Promise<void>((res) => server.close(() => res()));

      resolve({ baseUrl, server, cleanup });
    });
  });
}

export async function getToken(baseUrl: string, username: string): Promise<string> {
  const resp = await fetch(`${baseUrl}/api/auth/dev-token/${username}`);
  if (!resp.ok) {
    throw new Error(`Failed to get dev-token for ${username}: ${resp.status}`);
  }
  const data = (await resp.json()) as { token: string };
  return data.token;
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}
