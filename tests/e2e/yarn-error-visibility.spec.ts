import { test, expect } from "@playwright/test";

// Risk #6 (context/foundation/test-plan.md): a failed save/edit/delete/accept
// action must never leave the user without a clear, visible error state.
//
// Real scenario, no mocking: the yarn is deleted out from under the open
// detail page (e.g. a second tab, or a retried request) before the user
// confirms deletion there. The server correctly rejects the second delete —
// this test protects the promise that the UI actually *shows* that failure
// instead of leaving the user thinking the click did nothing.
test("deleting an already-deleted yarn shows a visible error, not silence", async ({ page }) => {
  const yarnName = `Race Yarn ${Date.now()}`;

  await page.goto("/yarns/new");
  // The form is a client:load React island — wait for it to hydrate before
  // typing, or fast automated input races the initial render and gets wiped.
  await page.waitForLoadState("networkidle");
  await page.getByRole("combobox", { name: "Producent" }).fill("Race Manufacturer");
  await page.getByRole("textbox", { name: "Nazwa" }).fill(yarnName);
  await page.getByRole("spinbutton", { name: "Ilość (motki)" }).fill("1");
  await page.getByRole("button", { name: "Dodaj włóczkę" }).click();

  await page.waitForURL("/dashboard");
  await page.getByRole("link").filter({ hasText: yarnName }).click();
  await page.waitForURL(/\/yarns\/(?<id>[0-9a-f-]{36})$/);
  await expect(page.getByRole("heading", { level: 1, name: yarnName })).toBeVisible();

  const idMatch = /\/yarns\/([0-9a-f-]{36})$/.exec(page.url());
  if (!idMatch) throw new Error(`Expected a yarn detail URL, got ${page.url()}`);
  const yarnId = idMatch[1];

  // Delete it for real, through the real API, out from under the open tab —
  // no mocking. Simulated via an in-page fetch (a stand-in for a second tab)
  // rather than page.request, because Astro's CSRF guard rejects unsafe
  // methods without a same-origin Origin header, which only a real
  // browser-issued fetch sends automatically.
  const backgroundDelete = await page.evaluate(async (id: string) => {
    const res = await fetch(`/api/yarns/${id}`, { method: "DELETE" });
    return { ok: res.ok, status: res.status };
  }, yarnId);
  expect(backgroundDelete.ok).toBeTruthy();

  await page.getByRole("button", { name: "Usuń" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Usuń" }).click();

  await expect(dialog.getByText("Delete matched no yarn row")).toBeVisible();
  // The dialog must stay open on failure — a silent success-looking redirect
  // would be exactly the regression this risk describes.
  await expect(page).toHaveURL(new RegExp(`/yarns/${yarnId}$`));
});
