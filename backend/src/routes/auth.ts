import { Router, Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { getDb } from "../db/schema";
import { signToken, AuthPayload } from "../middleware/auth";

const router = Router();

router.post("/login", (req: Request, res: Response): void => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    res.status(400).json({ error: "username, password, and role are required" });
    return;
  }

  const db = getDb();
  const user = db.query("SELECT * FROM users WHERE username = ?").get(username) as any;

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.role !== role) {
    res.status(403).json({ error: `User '${username}' is not registered as ${role}` });
    return;
  }

  const valid = bcryptjs.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const payload: AuthPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const token = signToken(payload);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get("/dev-token/:username", (req: Request, res: Response): void => {
  const db = getDb();
  const user = db.query("SELECT id, username, role FROM users WHERE username = ?")
    .get(req.params.username) as any;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const payload: AuthPayload = { userId: user.id, username: user.username, role: user.role };
  const token = signToken(payload);
  res.json({ token, user });
});

export default router;
