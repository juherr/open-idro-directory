import type { Page } from "@playwright/test";

/** The result rows: buttons named after their identifier, such as `FR-V01 Voltline 01 …`. */
export function resultRows(page: Page, countryCode = "[A-Z]{2}") {
  return page.getByRole("button", { name: new RegExp(`^${countryCode}-[A-Z0-9]{3}\\b`) });
}

/** The row of the party named `name`. */
export function resultRow(page: Page, name: string) {
  return resultRows(page).filter({ hasText: name });
}

/** Searches `query` with the page's search box. */
export async function search(page: Page, query: string) {
  const box = page.getByRole("textbox");
  await box.fill(query);
  await box.press("Enter");
}
