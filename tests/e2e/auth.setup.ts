import { test as setup } from "@playwright/test";

// Logs in once via the real UI and reuses the resulting session for every
// other test via storageState — see tests/e2e/CLAUDE.md ("Authenticate via
// storageState — never log in through the UI inside individual tests"). The
// test account is provisioned separately (local Supabase Admin API), not by
// this setup — see CLAUDE.md for that one-time step / the CI workflow step.
const authFile = "playwright/.auth/user.json";
const email = process.env.E2E_TEST_EMAIL ?? "e2e-test@example.com";
const password = process.env.E2E_TEST_PASSWORD ?? "TestPassword123";

setup("authenticate", async ({ page }) => {
  await page.goto("/auth/signin");
  // SignInForm is a client:load React island — wait for it to hydrate before
  // typing, or fast automated input races the initial render and gets wiped
  // (see tests/e2e/seed.spec.ts for the same pattern).
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await page.context().storageState({ path: authFile });
});
