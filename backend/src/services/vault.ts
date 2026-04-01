import crypto from "crypto";
import fs from "fs";
import path from "path";

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

export function listSecrets(): Array<{ key: string; category: string; updatedAt: string }> {
  const vault = readVault();
  return Object.entries(vault).map(([key, entry]) => ({
    key,
    category: entry.category,
    updatedAt: entry.updatedAt,
  }));
}

export function getSecret(key: string): string | null {
  const vault = readVault();
  return vault[key]?.value ?? null;
}

export function setSecret(key: string, value: string, category: string): void {
  const vault = readVault();
  vault[key] = { value, category, updatedAt: new Date().toISOString() };
  writeVault(vault);
}

export function deleteSecret(key: string): boolean {
  const vault = readVault();
  if (!(key in vault)) return false;
  delete vault[key];
  writeVault(vault);
  return true;
}

export function getSecretsByCategory(category: string): Record<string, string> {
  const vault = readVault();
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(vault)) {
    if (entry.category === category) {
      result[key] = entry.value;
    }
  }
  return result;
}
