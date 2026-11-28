import { expect, test, type Request } from "@playwright/test";
import { E2E_FIXTURE } from "./fixtures/dataset.js";
import { resultRow, resultRows, search } from "./support/results.js";

const totalParties = E2E_FIXTURE.voltlineCount + 5;

function isPartySearch(url: URL, query: string) {
  return url.pathname === "/api/v1/parties" && url.searchParams.get("q") === query;
}

test("explorer lists parties, loads the next page and opens the detail panel", async ({ page }) => {
  await page.goto("/explore/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data explorer");
  await expect(resultRows(page)).toHaveCount(25);
  await expect(page.getByText("25 operators shown")).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(resultRows(page)).toHaveCount(totalParties);
  await expect(page.getByText(`${totalParties} operators shown`)).toBeVisible();
  await expect(resultRow(page, "Voltline 01")).toContainText("Active");

  await search(page, "Revoked");
  await expect(resultRows(page)).toHaveCount(1);
  await resultRow(page, "Revoked Charge France").click();

  const panel = page.getByRole("complementary", { name: "Party details" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("Revoked Charge France");
  await expect(panel).toContainText("FR-RVK");
  await expect(panel).toContainText("Revoked");
  await expect(panel).toContainText("Revoked Charge France SAS");
  await expect(panel.getByRole("link", { name: "France" })).toBeVisible();
  await expect(panel).toContainText("AFIREV");
  await expect(panel).toContainText("Official assignment");
  await expect(panel.getByRole("link", { name: /View official source/ })).toHaveAttribute(
    "href",
    "https://registry.example.org/fr-afirev",
  );

  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();
});

test("explorer keeps the latest query when an earlier response arrives late", async ({ page }) => {
  const { firstQuery, secondQuery } = E2E_FIXTURE;
  // The first query's response is held until the second query has rendered.
  let releaseFirst = () => {};
  const firstReleased = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  await page.route(
    (url) => isPartySearch(url, firstQuery),
    async (route) => {
      await firstReleased;
      await route.continue();
    },
  );

  await page.goto("/explore/");
  await expect(resultRows(page)).toHaveCount(25);

  const firstRequest = page.waitForRequest((request: Request) =>
    isPartySearch(new URL(request.url()), firstQuery),
  );
  await search(page, firstQuery);
  await firstRequest;
  await search(page, secondQuery);
  await expect(resultRow(page, "Beta Recharge")).toBeVisible();

  const firstResponse = page.waitForResponse((response) =>
    isPartySearch(new URL(response.url()), firstQuery),
  );
  releaseFirst();
  await (await firstResponse).finished();
  // Lets the page parse and handle the late response before asserting.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 250)));

  await expect(resultRows(page)).toHaveCount(1);
  await expect(resultRow(page, "Beta Recharge")).toBeVisible();
  await expect(resultRow(page, "Alpha Laden")).toHaveCount(0);
  await expect(page.getByText("1 operators shown")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("q")).toBe(secondQuery);
});

test("explorer language switch persists across a reload", async ({ page }) => {
  const title = page.getByRole("heading", { level: 1 });
  await page.goto("/explore/");
  await expect(title).toHaveText("Data explorer");

  await page.getByRole("button", { name: "FR", exact: true }).click();
  await expect(title).toHaveText("Explorateur de données");
  await expect(page.getByRole("button", { name: "Rechercher" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.reload();
  await expect(title).toHaveText("Explorateur de données");
  await expect(page.getByText("25 opérateurs affichés")).toBeVisible();

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(title).toHaveText("Data explorer");
  await page.reload();
  await expect(title).toHaveText("Data explorer");
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
});
