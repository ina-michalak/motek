import { defineConfig, devices } from "@playwright/test";

// E2E runs always target the local Supabase stack (npx supabase start) via
// `npm run dev:test`, never the real remote project — see .env.test and
// src/lib/testing/supabase-test-client.ts for the same local-first pattern
// used by integration tests.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Produced by the "setup" project (tests/e2e/auth.setup.ts), which
        // logs in via the real UI once per run — see tests/e2e/CLAUDE.md.
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
