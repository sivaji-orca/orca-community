import { test, expect } from "@playwright/test";

test.describe("Onboarding flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("orca_onboarding", "pending");
    });
    await page.goto("/");
  });

  test("shows the brand step first with correct UI", async ({ page }) => {
    await expect(page.getByText("Brand Your App")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/Dhurandhar/)).toBeVisible();
    await expect(page.getByText("Continue")).toBeVisible();
  });

  test("can fill in brand name and navigate to next step", async ({ page }) => {
    await expect(page.getByText("Brand Your App")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/Dhurandhar/).fill("TestOrcaApp");

    const continueButtons = page.getByRole("button", { name: "Continue" });
    await continueButtons.first().click();

    await expect(page.getByText(/Welcome|Prerequisites|Getting Started/i)).toBeVisible({ timeout: 10_000 });
  });

  test("step indicator shows numbered steps", async ({ page }) => {
    await expect(page.getByText("Brand Your App")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("1")).toBeVisible();
  });
});
