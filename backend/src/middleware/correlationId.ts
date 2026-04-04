import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { maskPayload } from "../services/security";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers["x-correlation-id"] as string) || randomUUID();
  req.correlationId = id;
  res.setHeader("X-Correlation-Id", id);
  next();
}

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method;
  const url = req.originalUrl || req.url;
  const cid = req.correlationId || "-";

  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    const masked = maskPayload(req.body as Record<string, unknown>);
    console.log(`[${cid}] ${method} ${url} body=${JSON.stringify(masked)}`);
  } else {
    console.log(`[${cid}] ${method} ${url}`);
  }
  next();
}
