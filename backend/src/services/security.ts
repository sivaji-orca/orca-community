import crypto from "crypto";

// ─── PII/PCI Field Classification ─────────────────────────────────────────────

export type Sensitivity = "public" | "internal" | "pii" | "pci" | "secret";

export const FIELD_CLASSIFICATIONS: Record<string, Sensitivity> = {
  email: "pii",
  phone: "pii",
  first_name: "pii",
  last_name: "pii",
  instance_url: "internal",
  sf_id: "internal",
  account_id: "internal",
  correlation_id: "internal",
  password: "secret",
  security_token: "secret",
  api_key: "secret",
  api_secret: "secret",
  client_secret: "secret",
  database_url: "secret",
  bootstrap_servers: "internal",
  schema_registry_url: "internal",
  schema_registry_api_key: "secret",
  schema_registry_api_secret: "secret",
  card_number: "pci",
  cvv: "pci",
  expiry: "pci",
};

export function classifyField(fieldName: string): Sensitivity {
  const normalized = fieldName.toLowerCase().replace(/[-\s]/g, "_");
  if (FIELD_CLASSIFICATIONS[normalized]) return FIELD_CLASSIFICATIONS[normalized];
  if (normalized.includes("password") || normalized.includes("secret") || normalized.includes("token")) return "secret";
  if (normalized.includes("email")) return "pii";
  if (normalized.includes("phone")) return "pii";
  if (normalized.includes("card") || normalized.includes("cvv")) return "pci";
  return "public";
}

// ─── Masking Functions ────────────────────────────────────────────────────────

export function maskEmail(email: string): string {
  if (!email || email.length < 4) return "***";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const local = parts[0];
  const domain = parts[1];
  return `${local[0]}***@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "***";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export function maskName(name: string): string {
  if (!name || name.length < 1) return "***";
  return `${name[0]}***`;
}

export function maskPCI(value: string): string {
  if (!value || value.length < 4) return "****";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****-****-****-${digits.slice(-4)}`;
}

export function maskGeneric(value: string): string {
  if (!value) return "••••••••";
  return "••••••••";
}

export function maskField(fieldName: string, value: string): string {
  if (value === null || value === undefined) return "";
  const sensitivity = classifyField(fieldName);
  switch (sensitivity) {
    case "pii": {
      const lower = fieldName.toLowerCase();
      if (lower.includes("email")) return maskEmail(value);
      if (lower.includes("phone")) return maskPhone(value);
      if (lower.includes("name")) return maskName(value);
      return maskGeneric(value);
    }
    case "pci":
      return maskPCI(value);
    case "secret":
      return maskGeneric(value);
    case "internal":
    case "public":
    default:
      return value;
  }
}

export function maskPayload<T extends Record<string, unknown>>(
  obj: T,
  overrides?: Record<string, Sensitivity>
): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val !== "string") continue;
    const sensitivity = overrides?.[key] ?? classifyField(key);
    if (sensitivity === "pii" || sensitivity === "pci" || sensitivity === "secret") {
      (result as Record<string, unknown>)[key] = maskField(key, val);
    }
  }
  return result;
}

// ─── Field-Level Encryption/Decryption ────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";

function getMasterKey(): Buffer {
  const key = process.env.VAULT_MASTER_KEY || "orca-community-vault-master-key-aes256";
  return crypto.createHash("sha256").update(key).digest();
}

function deriveSubKey(context: string): Buffer {
  const master = getMasterKey();
  return crypto.createHmac("sha256", master).update(context).digest();
}

export function encryptField(plaintext: string, context = "default"): string {
  const key = deriveSubKey(`field:${context}`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptField(ciphertext: string, context = "default"): string {
  if (!ciphertext.startsWith("enc:")) return ciphertext;
  const parts = ciphertext.slice(4).split(":");
  if (parts.length !== 3) return ciphertext;
  const [ivHex, authTagHex, encrypted] = parts;
  const key = deriveSubKey(`field:${context}`);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

const PII_FIELDS = ["email", "phone", "first_name", "last_name"];

export function encryptPiiFields<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const field of PII_FIELDS) {
    if (typeof result[field] === "string" && !String(result[field]).startsWith("enc:")) {
      (result as Record<string, unknown>)[field] = encryptField(result[field] as string, `pii:${field}`);
    }
  }
  return result;
}

export function decryptPiiFields<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const field of PII_FIELDS) {
    if (typeof result[field] === "string" && String(result[field]).startsWith("enc:")) {
      (result as Record<string, unknown>)[field] = decryptField(result[field] as string, `pii:${field}`);
    }
  }
  return result;
}

// ─── Encryption Status ────────────────────────────────────────────────────────

export function getEncryptionStatus(): {
  enabled: boolean;
  algorithm: string;
  keySource: string;
  keyAge: string | null;
  fieldEncryptionEnabled: boolean;
} {
  const hasCustomKey = !!process.env.VAULT_MASTER_KEY;
  return {
    enabled: true,
    algorithm: "AES-256-GCM",
    keySource: hasCustomKey ? "environment (VAULT_MASTER_KEY)" : "default (built-in)",
    keyAge: null,
    fieldEncryptionEnabled: true,
  };
}

export function getFieldRegistry(): Array<{
  field: string;
  sensitivity: Sensitivity;
  maskingRule: string;
  example: string;
}> {
  return Object.entries(FIELD_CLASSIFICATIONS).map(([field, sensitivity]) => {
    let maskingRule = "none";
    let example = "";
    switch (sensitivity) {
      case "pii": {
        if (field.includes("email")) { maskingRule = "first char + *** + domain"; example = "j***@example.com"; }
        else if (field.includes("phone")) { maskingRule = "*** + last 4 digits"; example = "***1234"; }
        else if (field.includes("name")) { maskingRule = "first char + ***"; example = "J***"; }
        else { maskingRule = "full mask"; example = "••••••••"; }
        break;
      }
      case "pci": { maskingRule = "****-****-****-last4"; example = "****-****-****-1234"; break; }
      case "secret": { maskingRule = "full mask"; example = "••••••••"; break; }
      case "internal": { maskingRule = "passthrough"; example = "(unchanged)"; break; }
      default: { maskingRule = "passthrough"; example = "(unchanged)"; }
    }
    return { field, sensitivity, maskingRule, example };
  });
}
