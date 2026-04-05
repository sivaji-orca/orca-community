import { test, expect } from "@playwright/test";

test.describe("Onboarding flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test("shows the brand step first with correct UI", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Brand Your App/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("brand step has app name input and continue button", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Brand Your App/i })).toBeVisible({ timeout: 10_000 });
    const nameInput = page.locator('input[placeholder*="Dhurandhar"]');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    const placeholder = await nameInput.getAttribute("placeholder");
    expect(placeholder).toContain("Dhurandhar");
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("step indicator shows numbered steps", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Brand Your App/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("1")).toBeVisible();
  });
});
