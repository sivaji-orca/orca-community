import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, type TestContext } from "./helpers";

let ctx: TestContext;

beforeAll(async () => { ctx = await startTestServer(); });
afterAll(async () => { await ctx.cleanup(); });

describe("POST /api/auth/login", () => {
  it("returns a token for valid admin credentials", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.token).toBeTruthy();
    expect(data.user.role).toBe("administrator");
  });

  it("returns a token for valid developer credentials", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "developer", password: "developer" }),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.token).toBeTruthy();
    expect(data.user.role).toBe("developer");
  });

  it("returns 401 for invalid credentials", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
    expect(resp.status).toBe(401);
  });

  it("returns 400 when username or password is missing", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin" }),
    });
    expect(resp.status).toBe(400);
  });

  it("returns 401 for non-existent user", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "noone", password: "pass" }),
    });
    expect(resp.status).toBe(401);
  });
});

describe("GET /api/auth/dev-token/:username", () => {
  it("returns a token for admin user", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/auth/dev-token/admin`);
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.token).toBeTruthy();
    expect(data.token.split(".")).toHaveLength(3);
  });

  it("returns 404 for unknown user", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/auth/dev-token/nobody`);
    expect(resp.status).toBe(404);
  });
});
