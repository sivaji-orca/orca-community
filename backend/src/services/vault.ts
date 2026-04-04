import crypto from "crypto";
import fs from "fs";
import path from "path";

interface AuditContext {
  correlationId?: string;
  userId?: string;
  ipAddress?: string;
}

const DATA_DIR = path.join(import.meta.dir, "../../data");
const VAULT_PATH = path.join(DATA_DIR, "vault.enc");
const ALGORITHM = "aes-256-gcm";

function getMasterKey(): Buffer {
  const key = process.env.VAULT_MASTER_KEY || "orca-community-vault-master-key-aes256";
  return crypto.createHash("sha256").update(key).digest();
}

interface VaultData {
  [key: string]: { value: string; category: string; updatedAt: string };
}

function encrypt(text: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const key = getMasterKey();
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readVault(): VaultData {
  ensureDataDir();
  if (!fs.existsSync(VAULT_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(VAULT_PATH, "utf8");
  if (!raw.trim()) return {};
  const decrypted = decrypt(raw);
  return JSON.parse(decrypted);
}

function writeVault(data: VaultData): void {
  ensureDataDir();
  const json = JSON.stringify(data);
  const encrypted = encrypt(json);
  fs.writeFileSync(VAULT_PATH, encrypted, "utf8");
}

function wsKey(key: string, workspaceId?: number): string {
  if (workspaceId && workspaceId > 1) return `ws:${workspaceId}:${key}`;
  return key;
}

function maskSecretKey(key: string): string {
  if (key.length <= 6) return key;
  return key.slice(0, 3) + "***" + key.slice(-3);
}

function logAudit(action: "read" | "write" | "delete", secretKey: string, ctx?: AuditContext): void {
  try {
    const { getDb } = require("../db/schema");
    const db = getDb();
    db.run(
      "INSERT INTO vault_audit (correlation_id, action, secret_key, user_id, ip_address) VALUES (?, ?, ?, ?, ?)",
      [
        ctx?.correlationId || "system",
        action,
        maskSecretKey(secretKey),
        ctx?.userId || null,
        ctx?.ipAddress || null,
      ]
    );
  } catch {
    // Don't let audit failures break vault operations
  }
}

export function listSecrets(workspaceId?: number): Array<{ key: string; category: string; updatedAt: string }> {
  const vault = readVault();
  const prefix = workspaceId && workspaceId > 1 ? `ws:${workspaceId}:` : "";

  return Object.entries(vault)
    .filter(([k]) => {
      if (prefix) return k.startsWith(prefix);
      return !k.startsWith("ws:");
    })
    .map(([key, entry]) => ({
      key: prefix ? key.slice(prefix.length) : key,
      category: entry.category,
      updatedAt: entry.updatedAt,
    }));
}

export function getSecret(key: string, workspaceId?: number, auditCtx?: AuditContext): string | null {
  const vault = readVault();
  logAudit("read", key, auditCtx);
  if (workspaceId && workspaceId > 1) {
    const scoped = vault[`ws:${workspaceId}:${key}`];
    if (scoped) return scoped.value;
  }
  return vault[key]?.value ?? null;
}

export function setSecret(key: string, value: string, category: string, workspaceId?: number, auditCtx?: AuditContext): void {
  const vault = readVault();
  const storeKey = wsKey(key, workspaceId);
  vault[storeKey] = { value, category, updatedAt: new Date().toISOString() };
  writeVault(vault);
  logAudit("write", key, auditCtx);
}

export function deleteSecret(key: string, workspaceId?: number, auditCtx?: AuditContext): boolean {
  const vault = readVault();
  const storeKey = wsKey(key, workspaceId);
  if (!(storeKey in vault)) return false;
  delete vault[storeKey];
  writeVault(vault);
  logAudit("delete", key, auditCtx);
  return true;
}

export function getSecretsByCategory(category: string, workspaceId?: number): Record<string, string> {
  const vault = readVault();
  const result: Record<string, string> = {};
  const prefix = workspaceId && workspaceId > 1 ? `ws:${workspaceId}:` : "";

  for (const [key, entry] of Object.entries(vault)) {
    if (entry.category !== category) continue;
    if (prefix && key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = entry.value;
    } else if (!prefix && !key.startsWith("ws:")) {
      result[key] = entry.value;
    }
  }
  return result;
}
