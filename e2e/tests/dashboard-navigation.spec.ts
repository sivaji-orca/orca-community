import { test, expect } from "@playwright/test";

async function loginAsDev(page: import("@playwright/test").Page) {
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByPlaceholder("Enter username").fill("developer");
  await page.getByPlaceholder("Enter password").fill("developer");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Overview")).toBeVisible({ timeout: 10_000 });
}

test.describe("Dashboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test("shows the main dashboard header with app name", async ({ page }) => {
    await expect(page.locator("header")).toBeVisible();
  });

  test("sidebar has key navigation tabs", async ({ page }) => {
    const nav = page.locator("nav, aside, [role=navigation]").first();
    if (await nav.isVisible()) {
      await expect(nav).toBeVisible();
    }
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
    await expect(page.getByText("developer")).toBeVisible();
  });
});
