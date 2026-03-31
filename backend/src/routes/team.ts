import { Router, Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { getDb } from "../db/schema";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

router.use(authenticateToken);

router.get("/", (_req: Request, res: Response): void => {
  const db = getDb();
  const users = db.query("SELECT id, username, role, created_by, created_at FROM users").all();
  res.json(users);
});

router.post("/", requireRole("administrator"), (req: Request, res: Response): void => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    res.status(400).json({ error: "username, password, and role are required" });
    return;
  }

  if (!["administrator", "developer"].includes(role)) {
    res.status(400).json({ error: "role must be 'administrator' or 'developer'" });
    return;
  }

  const db = getDb();
  const existing = db.query("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    res.status(409).json({ error: `User '${username}' already exists` });
    return;
  }

  const hash = bcryptjs.hashSync(password, 10);
  const result = db.run(
    "INSERT INTO users (username, password_hash, role, created_by) VALUES (?, ?, ?, ?)",
    [username, hash, role, req.user!.username]
  );

  res.status(201).json({ id: result.lastInsertRowid, username, role });
});

router.put("/:id", requireRole("administrator"), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  const db = getDb();
  const user = db.query("SELECT * FROM users WHERE id = ?").get(Number(id)) as any;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const newUsername = username || user.username;
  const newRole = role || user.role;
  const newHash = password ? bcryptjs.hashSync(password, 10) : user.password_hash;

  db.run("UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?",
    [newUsername, newHash, newRole, Number(id)]);

  res.json({ id: Number(id), username: newUsername, role: newRole });
});

router.delete("/:id", requireRole("administrator"), (req: Request, res: Response): void => {
  const { id } = req.params;

  const db = getDb();
  const user = db.query("SELECT * FROM users WHERE id = ?").get(Number(id)) as any;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.username === "sivaji") {
    res.status(403).json({ error: "Cannot delete the primary admin account" });
    return;
  }

  db.run("DELETE FROM users WHERE id = ?", [Number(id)]);
  res.json({ message: `User '${user.username}' deleted` });
});

export default router;
