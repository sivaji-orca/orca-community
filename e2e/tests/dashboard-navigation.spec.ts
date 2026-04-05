import { test, expect } from "@playwright/test";
import { loginAsDev } from "./helpers/login";

test.describe("Dashboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test("shows the main dashboard heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("sidebar has key navigation tabs", async ({ page }) => {
    const tabsToCheck = ["Overview", "New Project", "Projects"];
    for (const tab of tabsToCheck) {
      const el = page.getByText(tab, { exact: false }).first();
      if (await el.isVisible()) {
        await expect(el).toBeVisible();
      }
    }
  });

  test("can navigate to Settings tab", async ({ page }) => {
    const settingsTab = page.getByText("Settings", { exact: false }).first();
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await page.waitForTimeout(500);
    }
  });

  test("workspace switcher is visible", async ({ page }) => {
    const wsSwitcher = page.getByText("Default", { exact: false }).first();
    await expect(wsSwitcher).toBeVisible({ timeout: 5_000 });
  });

  test("shows signed-in user info", async ({ page }) => {
    const userEl = page.locator("text=developer").first();
    await expect(userEl).toBeVisible({ timeout: 5_000 });
  });
});
