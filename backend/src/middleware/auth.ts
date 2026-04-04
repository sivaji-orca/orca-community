import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "orca-community-local-dev-secret-key-2026";

export interface AuthPayload {
  userId: number;
  username: string;
  role: "administrator" | "developer";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      workspaceId: number;
      workspaceName: string;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function resolveWorkspace(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers["x-workspace-id"];
  const wsId = header ? Number(header) : 1;
  req.workspaceId = isNaN(wsId) || wsId < 1 ? 1 : wsId;

  const { getDb } = require("../db/schema");
  const db = getDb();
  const ws = db.query("SELECT name FROM workspaces WHERE id = ?").get(req.workspaceId) as { name: string } | null;
  req.workspaceName = ws?.name || "Default";

  next();
}
