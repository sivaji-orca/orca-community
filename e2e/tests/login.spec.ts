import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("orca_onboarding_complete", "true");
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test("shows login form with branding", async ({ page }) => {
    await expect(page.getByText("Orca")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("Enter username")).toBeVisible();
    await expect(page.getByPlaceholder("Enter password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("shows default credential hints", async ({ page }) => {
    await expect(page.getByText(/developer \/ developer/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/admin \/ admin/)).toBeVisible();
  });

  test("developer login returns valid token via API", async () => {
    const resp = await fetch("http://localhost:3003/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "developer", password: "developer" }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.token).toBeTruthy();
    expect(body.user.username).toBe("developer");
    expect(body.user.role).toBe("developer");
  });

  test("admin login returns valid token via API", async () => {
    const resp = await fetch("http://localhost:3003/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.token).toBeTruthy();
    expect(body.user.username).toBe("admin");
    expect(body.user.role).toBe("administrator");
  });

  test("invalid credentials rejected by API", async () => {
    const resp = await fetch("http://localhost:3003/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "invalid", password: "wrong" }),
    });
    expect(resp.status).toBe(401);
  });

  test("has a link to run the setup wizard again", async ({ page }) => {
    await expect(page.getByText(/setup wizard/i)).toBeVisible({ timeout: 10_000 });
  });
});
