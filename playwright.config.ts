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
    // Logged in once by hand via Playwright CLI and saved with
    // `playwright-cli state-save playwright/.auth/user.json` — see
    // tests/e2e/CLAUDE.md. Re-run that when the session expires.
    storageState: "playwright/.auth/user.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
