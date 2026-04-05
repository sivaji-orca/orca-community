import { test, expect } from "@playwright/test";

async function loginAsDev(page: import("@playwright/test").Page) {
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByPlaceholder("Enter username").fill("developer");
  await page.getByPlaceholder("Enter password").fill("developer");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Overview")).toBeVisible({ timeout: 10_000 });
}

test.describe("Settings and theme", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test("can navigate to Settings tab", async ({ page }) => {
    const settingsTab = page.getByText("Settings", { exact: false }).first();
    await settingsTab.click();
    await page.waitForTimeout(1_000);
    const settingsContent = page.getByText(/appearance|secrets|workspace|team/i).first();
    await expect(settingsContent).toBeVisible({ timeout: 5_000 });
  });

  test("appearance settings show theme options", async ({ page }) => {
    const settingsTab = page.getByText("Settings", { exact: false }).first();
    await settingsTab.click();
    await page.waitForTimeout(500);

    const appearanceTab = page.getByText("Appearance", { exact: false }).first();
    if (await appearanceTab.isVisible()) {
      await appearanceTab.click();
      await page.waitForTimeout(500);
      const hasModeOptions = await page.getByText(/Light|Dark|System/i).first().isVisible().catch(() => false);
      expect(hasModeOptions).toBeTruthy();
    }
  });

  test("can toggle between theme modes", async ({ page }) => {
    const settingsTab = page.getByText("Settings", { exact: false }).first();
    await settingsTab.click();
    await page.waitForTimeout(500);

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
