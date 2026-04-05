import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startTestServer, type TestContext } from "./helpers";

let ctx: TestContext;

beforeAll(async () => { ctx = await startTestServer(); });
afterAll(async () => { await ctx.cleanup(); });

describe("GET /api/branding", () => {
  it("returns default branding", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/branding`);
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.appName).toBeTruthy();
    expect(data.appShortName).toBeTruthy();
    expect(data.description).toBeTruthy();
  });
});

describe("POST /api/branding", () => {
  it("updates branding with a custom name", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/branding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appName: "TestBrand", description: "Test Description" }),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.appName).toBe("TestBrand");
    expect(data.appShortName).toBe("TestBrand");
    expect(data.description).toBe("Test Description");
  });

  it("returns 400 when appName is missing", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/branding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "No name" }),
    });
    expect(resp.status).toBe(400);
  });

  it("restores default branding for cleanup", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/branding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appName: "Orca Community Edition", description: "MuleSoft Developer Productivity Tool" }),
    });
    expect(resp.status).toBe(200);
  });
});

describe("POST /api/branding/avatar", () => {
  it("generates a default avatar", async () => {
    const resp = await fetch(`${ctx.baseUrl}/api/branding/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appName: "Dhurandhar" }),
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as any;
    expect(data.svg).toContain("<svg");
    expect(data.svg).toContain(">D<");
  });
});
