import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, getToken, authHeaders, type TestContext } from "./helpers";

let ctx: TestContext;
let adminToken: string;

beforeAll(async () => {
  ctx = await startTestServer();
  adminToken = await getToken(ctx.baseUrl, "admin");
});
afterAll(async () => { await ctx.cleanup(); });

describe("GET /api/workspaces", () => {
  it("returns the default workspace", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/workspaces`, {
      headers: authHeaders(adminToken),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const def = data.find((w: any) => w.is_default === 1);
    expect(def).toBeTruthy();
  });
});

describe("POST /api/workspaces", () => {
  it("creates a new workspace", async () => {
    const name = `int-test-${Date.now()}`;
    const resp = await fetch(`${ctx.baseUrl}/api/workspaces`, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({ name }),
    });
    expect([200, 201]).toContain(resp.status);
    const data = (await resp.json()) as any;
    expect(data.name).toBe(name);
    expect(data.id).toBeGreaterThan(0);
  });

  it("rejects workspace without a name", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/workspaces`, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({}),
    });
    expect(resp.status).toBe(400);
  });
});

describe("Workspace header isolation", () => {
  it("accepts X-Workspace-Id header", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/workspaces`, {
      headers: { ...authHeaders(adminToken), "X-Workspace-Id": "1" },
    });
    expect(resp.status).toBe(200);
  });
});

describe("Auth enforcement on workspaces", () => {
  it("returns 401 without token", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/workspaces`);
    expect(resp.status).toBe(401);
  });
});
