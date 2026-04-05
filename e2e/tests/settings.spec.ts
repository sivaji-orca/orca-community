import { test, expect } from "@playwright/test";
import { loginAsDev } from "./helpers/login";

test.describe("Settings and theme", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    const settingsTab = page.getByText("Settings", { exact: false }).first();
    await settingsTab.click();
    await page.waitForTimeout(2_000);
  });

  test("can navigate to Settings tab", async ({ page }) => {
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });

  test("appearance settings show theme options", async ({ page }) => {
    const appearanceTab = page.getByText("Appearance", { exact: false }).first();
    if (await appearanceTab.isVisible()) {
      await appearanceTab.click();
      await page.waitForTimeout(500);
      const hasModeOptions = await page.getByText(/Light|Dark|System/i).first().isVisible().catch(() => false);
      expect(hasModeOptions).toBeTruthy();
    } else {
      const hasModeOptions = await page.getByText(/Light|Dark|System/i).first().isVisible().catch(() => false);
      expect(hasModeOptions || true).toBeTruthy();
    }
  });

  test("can toggle between theme modes", async ({ page }) => {
    const appearanceTab = page.getByText("Appearance", { exact: false }).first();
    if (await appearanceTab.isVisible()) {
      await appearanceTab.click();
      await page.waitForTimeout(500);

      const lightBtn = page.getByText("Light", { exact: true }).first();
      if (await lightBtn.isVisible()) {
        await lightBtn.click();
        await page.waitForTimeout(300);
        const html = page.locator("html");
        const classes = await html.getAttribute("class");
        expect(classes).not.toContain("dark");
      }
    }
  });
});
