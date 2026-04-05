import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
  });

  test("shows login form with branding", async ({ page }) => {
    await expect(page.getByText("Orca")).toBeVisible();
    await expect(page.getByText("MuleSoft Developer Productivity Tool")).toBeVisible();
    await expect(page.getByPlaceholder("Enter username")).toBeVisible();
    await expect(page.getByPlaceholder("Enter password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("shows default credential hints", async ({ page }) => {
    await expect(page.getByText(/developer \/ developer/)).toBeVisible();
    await expect(page.getByText(/admin \/ admin/)).toBeVisible();
  });

  test("logs in as developer with valid credentials", async ({ page }) => {
    await page.getByPlaceholder("Enter username").fill("developer");
    await page.getByPlaceholder("Enter password").fill("developer");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Overview")).toBeVisible({ timeout: 10_000 });
  });

  test("logs in as admin with valid credentials", async ({ page }) => {
    await page.getByPlaceholder("Enter username").fill("admin");
    await page.getByPlaceholder("Enter password").fill("admin");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Overview")).toBeVisible({ timeout: 10_000 });
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.getByPlaceholder("Enter username").fill("invalid");
    await page.getByPlaceholder("Enter password").fill("wrong");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/invalid|error/i)).toBeVisible({ timeout: 5_000 });
  });

  test("has a link to run the setup wizard again", async ({ page }) => {
    await expect(page.getByText(/setup wizard/i)).toBeVisible();
  });
});
