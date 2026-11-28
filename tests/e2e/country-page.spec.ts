import { expect, test, type Page } from "@playwright/test";
import { E2E_FIXTURE } from "./fixtures/dataset.js";
import { resultRow, resultRows, search } from "./support/results.js";

// The language link is absolute, on the canonical production origin: follow
// its path on the site under test instead of leaving it.
async function followLanguageLink(page: Page, name: string) {
  const href = await page.getByRole("link", { name }).getAttribute("href");
  const target = new URL(href ?? "", page.url());
  await page.goto(target.pathname + target.search);
}

// The value of one fact of a source card: the description that follows its
// term in the card's description list, whatever the markup classes.
function sourceFact(page: Page, sourceName: string, term: string) {
  return page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: sourceName, exact: true }) })
    .locator(`xpath=.//dt[normalize-space()="${term}"]/following-sibling::dd[1]`);
}

test("country search on /countries/fr/ stays in France", async ({ page }) => {
  await page.goto("/countries/fr/");
  await expect(page.getByRole("heading", { name: "Search identifiers" })).toBeVisible();
  await expect(sourceFact(page, "AFIREV", "Freshness")).toHaveText("Current");
  await expect(resultRows(page, "FR")).toHaveCount(25);

  await search(page, E2E_FIXTURE.sharedName);
  await expect(resultRow(page, "Shared Mobility France")).toBeVisible();
  await expect(resultRows(page)).toHaveCount(1);
  await expect(resultRow(page, "Shared Mobility Germany")).toHaveCount(0);
  await expect(page).toHaveURL(/\/countries\/fr\/\?q=Shared\+Mobility$/);

  // A German identifier is not searched: the page points to its country.
  await search(page, "DE*SHR");
  await expect(page.getByRole("status")).toHaveText("DESHR belongs to Germany.");
  await expect(resultRows(page)).toHaveCount(0);
});

test("country page language switch keeps French across a reload and a search", async ({ page }) => {
  await page.goto("/countries/fr/");
  await expect(page.getByRole("heading", { name: "Search identifiers" })).toBeVisible();

  await followLanguageLink(page, "Lire en français");
  await expect(page).toHaveURL(/\/countries\/fr\/\?lang=fr$/);
  const searchTitle = page.getByRole("heading", { name: "Rechercher des identifiants" });
  await expect(searchTitle).toBeVisible();
  await page.reload();
  await expect(searchTitle).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(sourceFact(page, "AFIREV", "Fraîcheur")).toHaveText("À jour");

  await search(page, E2E_FIXTURE.sharedName);
  await expect(resultRow(page, "Shared Mobility France")).toBeVisible();
  await expect(page).toHaveURL(/\/countries\/fr\/\?lang=fr&q=Shared\+Mobility$/);
  await page.reload();
  await expect(searchTitle).toBeVisible();
  await expect(resultRow(page, "Shared Mobility France")).toContainText("Actif");

  await followLanguageLink(page, "Read in English");
  await expect(page.getByRole("heading", { name: "Search identifiers" })).toBeVisible();
});

test("a country without published identifiers shows the empty state", async ({ page }) => {
  await page.goto("/countries/cy/");
  await expect(page.getByRole("heading", { name: "No published identifiers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search identifiers" })).toHaveCount(0);
});
