import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun run start",
      cwd: "../backend",
      port: 3003,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run dev",
      cwd: "../frontend",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
