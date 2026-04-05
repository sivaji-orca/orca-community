import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, getToken, authHeaders, type TestContext } from "./helpers";

let ctx: TestContext;
let devToken: string;

beforeAll(async () => {
  ctx = await startTestServer();
  devToken = await getToken(ctx.baseUrl, "developer");
});
afterAll(async () => { await ctx.cleanup(); });

describe("GET /api/security/fields", () => {
  it("returns the field registry", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/security/fields`, {
      headers: authHeaders(devToken),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data).toHaveProperty("fields");
    expect(data).toHaveProperty("total");
    expect(data.total).toBeGreaterThan(0);
    expect(data.fields[0]).toHaveProperty("field");
    expect(data.fields[0]).toHaveProperty("sensitivity");
  });
});

describe("GET /api/security/status", () => {
  it("returns overall security status", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/security/status`, {
      headers: authHeaders(devToken),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.encryption.enabled).toBe(true);
    expect(data.encryption.algorithm).toBe("AES-256-GCM");
    expect(data.piiClassification.enabled).toBe(true);
  });
});

describe("POST /api/security/test-mask", () => {
  it("masks a payload with sensitive fields", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/security/test-mask`, {
      method: "POST",
      headers: authHeaders(devToken),
      body: JSON.stringify({
        payload: { email: "test@example.com", phone: "5551234567", status: "active" },
      }),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.masked.email).not.toBe("test@example.com");
    expect(data.masked.status).toBe("active");
  });
});

describe("Auth enforcement on security", () => {
  it("returns 401 without token on /fields", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/security/fields`);
    expect(resp.status).toBe(401);
  });
});
