import { expect, type Page } from "@playwright/test";

const API_BASE = "http://localhost:3003";

async function fetchDevToken(username: string): Promise<{ token: string; user: { id: number; username: string; role: string } }> {
  const resp = await fetch(`${API_BASE}/api/auth/dev-token/${username}`);
  if (!resp.ok) throw new Error(`Failed to get token for ${username}: ${resp.status}`);
  return resp.json() as any;
}

export async function loginAsDev(page: Page) {
  const { token, user } = await fetchDevToken("developer");
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem("orca_onboarding_complete", "true");
      localStorage.setItem("orca_token", t);
      localStorage.setItem("orca_user", JSON.stringify(u));
    },
    [token, user] as const
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 15_000 });
}

export async function loginAsAdmin(page: Page) {
  const { token, user } = await fetchDevToken("admin");
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem("orca_onboarding_complete", "true");
      localStorage.setItem("orca_token", t);
      localStorage.setItem("orca_user", JSON.stringify(u));
    },
    [token, user] as const
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 15_000 });
}
