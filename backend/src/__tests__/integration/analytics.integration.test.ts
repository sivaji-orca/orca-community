import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, getToken, authHeaders, type TestContext } from "./helpers";

let ctx: TestContext;
let devToken: string;

beforeAll(async () => {
  ctx = await startTestServer();
  devToken = await getToken(ctx.baseUrl, "developer");
});
afterAll(async () => { await ctx.cleanup(); });

describe("GET /api/analytics/summary", () => {
  it("returns analytics summary for authenticated user", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/analytics/summary`, {
      headers: authHeaders(devToken),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data).toHaveProperty("totalRequests");
  });
});

describe("POST /api/analytics/record", () => {
  it("records an analytics event", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/analytics/record`, {
      method: "POST",
      headers: authHeaders(devToken),
      body: JSON.stringify({
        endpoint: "/api/test",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 42,
        projectName: "test-project",
      }),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.message).toBe("Metric recorded");
  });

  it("rejects missing required fields", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/analytics/record`, {
      method: "POST",
      headers: authHeaders(devToken),
      body: JSON.stringify({ endpoint: "/api/test" }),
    });
    expect(resp.status).toBe(400);
  });
});

describe("GET /api/analytics/timeline", () => {
  it("returns timeline data", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/analytics/timeline`, {
      headers: authHeaders(devToken),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Auth enforcement on analytics", () => {
  it("returns 401 without token", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/analytics/summary`);
    expect(resp.status).toBe(401);
  });
});
