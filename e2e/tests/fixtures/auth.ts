import { test as base, type Page } from "@playwright/test";

const API_BASE = "http://localhost:3003";

async function getDevToken(username: string): Promise<string> {
  const resp = await fetch(`${API_BASE}/api/auth/dev-token/${username}`);
  if (!resp.ok) throw new Error(`Failed to get dev token for ${username}: ${resp.status}`);
  const data = (await resp.json()) as { token: string };
  return data.token;
}

async function loginViaUI(page: Page, username: string, password: string) {
  await page.goto("/");
  await page.getByPlaceholder("Enter username").fill(username);
  await page.getByPlaceholder("Enter password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/.*/, { timeout: 10_000 });
}

async function injectToken(page: Page, token: string) {
  await page.goto("/");
  await page.evaluate((t) => localStorage.setItem("orca_token", t), token);
}

export const test = base.extend<{
  adminPage: Page;
  devPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const token = await getDevToken("admin");
      await injectToken(page, token);
    } catch {
      await loginViaUI(page, "admin", "admin");
    }
    await use(page);
    await context.close();
  },
  devPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      const token = await getDevToken("developer");
      await injectToken(page, token);
    } catch {
      await loginViaUI(page, "developer", "developer");
    }
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
