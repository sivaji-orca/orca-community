import { describe, it, expect } from "bun:test";
import {
  classifyField,
  maskEmail,
  maskPhone,
  maskName,
  maskPCI,
  maskField,
  maskPayload,
  encryptField,
  decryptField,
  encryptPiiFields,
  decryptPiiFields,
  getFieldRegistry,
  getEncryptionStatus,
} from "../../services/security";

describe("security - classifyField", () => {
  it("classifies known PII fields", () => {
    expect(classifyField("email")).toBe("pii");
    expect(classifyField("phone")).toBe("pii");
    expect(classifyField("first_name")).toBe("pii");
    expect(classifyField("last_name")).toBe("pii");
  });

  it("classifies known PCI fields", () => {
    expect(classifyField("card_number")).toBe("pci");
    expect(classifyField("cvv")).toBe("pci");
  });

  it("classifies secret fields", () => {
    expect(classifyField("password")).toBe("secret");
    expect(classifyField("api_key")).toBe("secret");
    expect(classifyField("client_secret")).toBe("secret");
  });

  it("classifies internal fields", () => {
    expect(classifyField("instance_url")).toBe("internal");
    expect(classifyField("correlation_id")).toBe("internal");
  });

  it("defaults to public for unknown fields", () => {
    expect(classifyField("description")).toBe("public");
    expect(classifyField("status")).toBe("public");
  });

  it("handles heuristic detection via substrings", () => {
    expect(classifyField("user_email_address")).toBe("pii");
    expect(classifyField("access_token")).toBe("secret");
    expect(classifyField("credit_card")).toBe("pci");
  });

  it("normalizes dashes and spaces", () => {
    expect(classifyField("first-name")).toBe("pii");
    expect(classifyField("FIRST NAME")).toBe("pii");
  });
});

describe("security - masking functions", () => {
  it("masks email correctly", () => {
    expect(maskEmail("john@example.com")).toBe("j***@example.com");
  });

  it("masks short email", () => {
    expect(maskEmail("ab")).toBe("***");
  });

  it("masks phone keeping last 4 digits", () => {
    expect(maskPhone("+1-555-123-4567")).toBe("***4567");
  });

  it("masks short phone", () => {
    expect(maskPhone("12")).toBe("***");
  });

  it("masks name keeping first char", () => {
    expect(maskName("John")).toBe("J***");
  });

  it("masks PCI showing last 4", () => {
    expect(maskPCI("4111111111111111")).toBe("****-****-****-1111");
  });

  it("maskField routes based on field name", () => {
    expect(maskField("email", "test@test.com")).toBe("t***@test.com");
    expect(maskField("phone", "5551234567")).toBe("***4567");
    expect(maskField("first_name", "Alice")).toBe("A***");
    expect(maskField("card_number", "4111111111111111")).toBe("****-****-****-1111");
    expect(maskField("password", "mysecret")).toBe("••••••••");
    expect(maskField("description", "public info")).toBe("public info");
  });
});

describe("security - maskPayload", () => {
  it("masks sensitive fields in an object", () => {
    const input = { email: "john@test.com", phone: "5551234567", name: "John", status: "active" };
    const masked = maskPayload(input);
    expect(masked.email).toBe("j***@test.com");
    expect(masked.phone).toBe("***4567");
    expect(masked.status).toBe("active");
  });

  it("leaves non-string values untouched", () => {
    const input = { email: "a@b.com", count: 42 as unknown as string };
    const masked = maskPayload(input as any);
    expect((masked as any).count).toBe(42);
  });
});

describe("security - encryption round-trip", () => {
  it("encrypts and decrypts a field correctly", () => {
    const original = "sensitive-data-123";
    const encrypted = encryptField(original, "test-context");
    expect(encrypted).toStartWith("enc:");
    expect(encrypted).not.toBe(original);
    const decrypted = decryptField(encrypted, "test-context");
    expect(decrypted).toBe(original);
  });

  it("different contexts produce different ciphertext", () => {
    const original = "same-data";
    const enc1 = encryptField(original, "ctx-a");
    const enc2 = encryptField(original, "ctx-b");
    expect(enc1).not.toBe(enc2);
  });

  it("decryptField returns non-encrypted strings as-is", () => {
    expect(decryptField("plain-text")).toBe("plain-text");
  });

  it("decryptField returns malformed enc: strings as-is", () => {
    expect(decryptField("enc:bad")).toBe("enc:bad");
  });
});

describe("security - PII field encryption", () => {
  it("encrypts and decrypts PII fields in an object", () => {
    const original = { email: "test@example.com", phone: "5551234567", first_name: "Alice", status: "active" };
    const encrypted = encryptPiiFields(original);
    expect(encrypted.email).toStartWith("enc:");
    expect(encrypted.phone).toStartWith("enc:");
    expect(encrypted.first_name).toStartWith("enc:");
    expect(encrypted.status).toBe("active");

    const decrypted = decryptPiiFields(encrypted);
    expect(decrypted.email).toBe("test@example.com");
    expect(decrypted.phone).toBe("5551234567");
    expect(decrypted.first_name).toBe("Alice");
  });

  it("does not double-encrypt already encrypted fields", () => {
    const original = { email: "test@example.com" };
    const once = encryptPiiFields(original);
    const twice = encryptPiiFields(once);
    expect(twice.email).toBe(once.email);
  });
});

describe("security - registry and status", () => {
  it("getFieldRegistry returns entries for known fields", () => {
    const registry = getFieldRegistry();
    expect(registry.length).toBeGreaterThan(0);
    const emailEntry = registry.find((r) => r.field === "email");
    expect(emailEntry).toBeTruthy();
    expect(emailEntry!.sensitivity).toBe("pii");
  });

  it("getEncryptionStatus reports algorithm and enabled state", () => {
    const status = getEncryptionStatus();
    expect(status.enabled).toBe(true);
    expect(status.algorithm).toBe("AES-256-GCM");
    expect(status.fieldEncryptionEnabled).toBe(true);
  });
});
