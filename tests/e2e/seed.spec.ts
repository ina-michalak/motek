import { test, expect } from "@playwright/test";

// Seed test — the exemplar every generated E2E test in this project is
// modeled on. Role-based locators, one self-contained cycle (create → verify
// → reload → verify → clean up), unique test data, wait-for-state only.
test("created yarn persists after a real page reload", async ({ page }) => {
  const yarnName = `Seed Yarn ${Date.now()}`;

  await page.goto("/yarns/new");
  // The form is a client:load React island — wait for it to hydrate before
  // typing, or fast automated input races the initial render and gets wiped.
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Producent" }).fill("Seed Manufacturer");
  await page.getByRole("textbox", { name: "Nazwa" }).fill(yarnName);
  await page.getByRole("spinbutton", { name: "Ilość (motki)" }).fill("1");
  await page.getByRole("button", { name: "Dodaj włóczkę" }).click();

  await page.waitForURL("/dashboard");
  await page.getByRole("link").filter({ hasText: yarnName }).click();
  await page.waitForURL(/\/yarns\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: yarnName })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: yarnName })).toBeVisible();

  // Cleanup
  await page.getByRole("button", { name: "Usuń" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Usuń" }).click();
  await page.waitForURL("/dashboard");
});
