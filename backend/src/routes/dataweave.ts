import { Router } from "express";
import {
  executeDw,
  getDwEngineStatus,
  getBuiltInExamples,
  getSnippets,
  saveSnippet,
  updateSnippet,
  deleteSnippet,
  saveExecution,
  getExecutionHistory,
  getExecutionById,
} from "../services/dataweave";

const router = Router();

router.post("/execute", (req, res) => {
  const { script, input, inputMimeType, outputMimeType } = req.body;
  if (!script || typeof script !== "string") {
    return res.status(400).json({ error: "script is required" });
  }
  try {
    const result = executeDw(
      script,
      input || "{}",
      inputMimeType || "application/json",
      outputMimeType || "application/json"
    );
    const workspaceId = (req as any).workspaceId || 1;
    const execId = saveExecution(
      { ...result, script, inputData: input || "{}", inputMime: inputMimeType || "application/json", outputMime: outputMimeType || "application/json" },
      workspaceId
    );
    res.json({ ...result, id: execId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/status", (_req, res) => {
  try {
    res.json(getDwEngineStatus());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/examples", (_req, res) => {
  res.json(getBuiltInExamples());
});

router.get("/snippets", (req, res) => {
  const workspaceId = (req as any).workspaceId || 1;
  res.json(getSnippets(workspaceId));
});

router.post("/snippets", (req, res) => {
  const { name, description, script, sampleInput, inputMime, outputMime, tags } = req.body;
  if (!name || !script) {
    return res.status(400).json({ error: "name and script are required" });
  }
  try {
    const workspaceId = (req as any).workspaceId || 1;
    const id = saveSnippet({ name, description, script, sampleInput, inputMime, outputMime, tags }, workspaceId);
    res.json({ id, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/snippets/:id", (req, res) => {
  const id = Number(req.params.id);
  try {
    updateSnippet(id, req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/snippets/:id", (req, res) => {
  const id = Number(req.params.id);
  try {
    deleteSnippet(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/history", (req, res) => {
  const workspaceId = (req as any).workspaceId || 1;
  res.json(getExecutionHistory(workspaceId));
});

router.get("/share/:id", (req, res) => {
  const id = Number(req.params.id);
  const execution = getExecutionById(id);
  if (!execution) return res.status(404).json({ error: "Execution not found" });
  res.json(execution);
});

export default router;
