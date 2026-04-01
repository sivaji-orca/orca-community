import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(import.meta.dir, "../.env"), debug: false });

import authRoutes from "./routes/auth";
import teamRoutes from "./routes/team";
import secretsRoutes from "./routes/secrets";
import anypointRoutes from "./routes/anypoint";
import gitRoutes from "./routes/git";
import runtimeRoutes from "./routes/runtime";
import postmanRoutes from "./routes/postman";
import projectsRoutes from "./routes/projects";
import deployRoutes from "./routes/deploy";
import loggingRoutes from "./routes/logging";
import analyticsRoutes from "./routes/analytics";
import salesforceRoutes from "./routes/salesforce";

import { startMetricsParsing } from "./services/analytics";

const app = express();
const PORT = Number(process.env.PORT) || 3003;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
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

startMetricsParsing();

const frontendDist = path.join(import.meta.dir, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Orca Community Edition running at http://localhost:${PORT}`);
});
