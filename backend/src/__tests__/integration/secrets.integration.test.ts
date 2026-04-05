import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, getToken, authHeaders, type TestContext } from "./helpers";

let ctx: TestContext;
let adminToken: string;
let devToken: string;

beforeAll(async () => {
  ctx = await startTestServer();
  adminToken = await getToken(ctx.baseUrl, "admin");
  devToken = await getToken(ctx.baseUrl, "developer");
});
afterAll(async () => { await ctx.cleanup(); });

describe("GET /api/secrets - role enforcement", () => {
  it("allows admin access (200 or 500 if vault is unconfigured)", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/secrets`, {
      headers: authHeaders(adminToken),
    });
    expect([200, 500]).toContain(resp.status);
  });

  it("returns 403 for developer role", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/secrets`, {
      headers: authHeaders(devToken),
    });
    expect(resp.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/secrets`);
    expect(resp.status).toBe(401);
  });
});

describe("POST /api/secrets - role enforcement", () => {
  it("developer cannot set a secret", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/secrets`, {
      method: "POST",
      headers: authHeaders(devToken),
      body: JSON.stringify({ key: "dev_key", value: "val", category: "test" }),
    });
    expect(resp.status).toBe(403);
  });

  it("admin reaches the secrets handler (not blocked by auth)", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/secrets`, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({ key: "test_key", value: "test_val", category: "test" }),
    });
    expect([201, 500]).toContain(resp.status);
  });
});

describe("DELETE /api/secrets - role enforcement", () => {
  it("developer cannot delete a secret", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/secrets/any_key`, {
      method: "DELETE",
      headers: authHeaders(devToken),
    });
    expect(resp.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/secrets/any_key`, {
      method: "DELETE",
    });
    expect(resp.status).toBe(401);
  });
});
