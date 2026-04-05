import { Router } from "express";
import { getBranding, setBranding, forkAndBrand, generateDefaultAvatar } from "../services/branding";

const router = Router();

router.get("/", (_req, res) => {
  try {
    const branding = getBranding();
    res.json(branding);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", (req, res) => {
  const { appName, description, logoSvg } = req.body;
  if (!appName || typeof appName !== "string" || appName.trim().length === 0) {
    return res.status(400).json({ error: "appName is required" });
  }
  try {
    const branding = setBranding(
      appName.trim(),
      description?.trim() || "MuleSoft Developer Productivity Tool",
      logoSvg || null
    );
    res.json(branding);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/fork", async (req, res) => {
  const { appName, description, targetDir } = req.body;
  if (!appName) {
    return res.status(400).json({ error: "appName is required" });
  }
  try {
    const result = await forkAndBrand(appName, description || "", targetDir);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/avatar", (req, res) => {
  const { appName } = req.body;
  const svg = generateDefaultAvatar(appName || "Orca");
  res.json({ svg });
});

export default router;
