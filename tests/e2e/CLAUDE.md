# E2E Testing Rules

- Use getByRole, getByLabel, getByText as primary locators.
  Fall back to getByTestId only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use page.waitForTimeout(). Wait for specific conditions:
  toBeVisible(), waitForURL(), waitForResponse().
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g., timestamp suffix) for test data
  to avoid collisions in parallel runs. Clean up in afterEach or at the end
  of the test.
- Authenticate via storageState — never log in through the UI inside
  individual tests.

## Project-specific

- The dev server for E2E always runs in "test" mode (`npm run dev:test` /
  the `dev:test` entry in `.claude/launch.json`), which loads `.env.test` —
  pointed at the local Supabase stack (`npx supabase start`), never the real
  remote project in `.env`.
- `playwright.config.ts` has a `setup` project (`tests/e2e/auth.setup.ts`)
  that the `chromium` project depends on: it logs in once via the real UI
  and saves the session to `playwright/.auth/user.json`, which every other
  test then reuses via `storageState`. This runs automatically on every
  `npm run test:e2e` — nothing to do by hand, and there's no stale-session
  failure mode to watch for since it's regenerated every run.
- The test account it logs in as (`e2e-test@example.com` / `TestPassword123`
  by default, overridable via `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`) must
  already exist in the local Supabase stack. Create it once per stack via
  the local Admin API (bypasses the email-confirmation/rate-limit flow, not
  through the signup UI):
  ```
  curl -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
    -H "apikey: <local service_role key from `npx supabase status`>" \
    -H "Authorization: Bearer <same key>" \
    -H "Content-Type: application/json" \
    -d '{"email":"e2e-test@example.com","password":"TestPassword123","email_confirm":true}'
  ```
  CI runs this same call against its own fresh stack on every run (see
  `.github/workflows/ci.yml`).
- Internal boundaries (auth, routing, Supabase/DB) stay real. Only mock
  external, non-deterministic third-party APIs at the network layer — this
  app has none in the yarn-management flows today.
- Name the test after the risk it protects, referencing
  `context/foundation/test-plan.md` when one exists (e.g. risk #6 — failed
  actions must show a visible error, not silence).
