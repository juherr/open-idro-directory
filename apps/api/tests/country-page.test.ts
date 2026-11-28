import { describe, expect, it } from "vitest";
import { countrySummaryPayload, type CountrySummary } from "../src/application/mappers.js";
import { renderCountryPage, renderErrorPage } from "../src/http/pages/country-page.js";
import {
  cyEms,
  irishStats,
  noStats,
  release,
  sourceRow,
  sources,
  tii,
} from "./support/country-fixtures.js";

function summaryFor(countryCode: string, rows = sources, stats = noStats): CountrySummary {
  const summary = countrySummaryPayload(countryCode, rows, stats, release);
  if (!summary) throw new Error(`No summary for ${countryCode}`);
  return summary;
}

const origin = "https://directory.example";

const SEARCH_SCRIPTS = ['<script src="/shared.js">', '<script type="module" src="/explorer.js">'];

/** Every opening script tag of the page, in document order. */
function scriptTags(page: string) {
  return page.match(/<script\b[^>]*>/gi) ?? [];
}

describe("country page", () => {
  it("renders a known IDRO without published identifiers as an explained empty state", async () => {
    const page = await renderCountryPage(summaryFor("CY"), origin);

    expect(page).toContain("<h1");
    expect(page).toContain("Cyprus");
    expect(page).toContain("Cyprus EMS");
    expect(page).toContain("No published identifiers");
    expect(page).toContain('class="trust-card country-empty"');
    expect(page).toContain('href="https://cy-ems.example/"');
    // Nothing to search, so no explorer link; the JSON summary stays reachable.
    expect(page).not.toContain("/explore/?country=CY");
    expect(page).toContain('href="/api/v1/countries/CY"');
  });

  it("does not deny a published list that has no identifiers for the country yet", async () => {
    // Benelux declares NL and publishes a list, but no NL identifier is known.
    const page = await renderCountryPage(summaryFor("NL"), origin);

    expect(page).toContain("No published identifiers");
    expect(page).not.toContain("publishes no machine-readable list");
    expect(page).toContain("holds no identifiers for Netherlands yet");
  });

  it("makes no claim about a published list the directory has never retrieved", async () => {
    const rows = sources.map((row) =>
      row.id === "benelux-idro" ? { ...row, last_successful_at: null } : row,
    );
    const page = await renderCountryPage(summaryFor("NL", rows), origin);

    expect(page).toContain("No published identifiers");
    expect(page).toContain("this directory has not retrieved it yet");
    expect(page).not.toContain("holds no identifiers");
    expect(page).not.toContain("publishes no machine-readable list");
  });

  it("describes several retrieved lists in the plural", async () => {
    const nlNap = { id: "nl-nap", name: "NL NAP", jurisdictions: ["NL"] };
    const rows = [...sources, sourceRow("nl-nap", nlNap)];
    const page = await renderCountryPage(summaryFor("NL", rows), origin);

    expect(page).toContain("Their published lists hold no identifiers for Netherlands yet");
    expect(page).not.toContain("Its published list holds no identifiers");
  });

  it("agrees the empty-state verbs with several authorities", async () => {
    // Without identifiers, Ireland has two authorities: EV Roam and TII.
    const page = await renderCountryPage(summaryFor("IE"), origin);

    expect(page).toContain(
      "EV Roam and Transport Infrastructure Ireland manage e-mobility identifiers for Ireland.",
    );
    expect(page).toContain("Their published lists hold no identifiers");
    expect(page).toContain("Ask the authorities below");
    expect(page).not.toContain(" manages ");
  });

  it("describes several unretrieved lists in the plural", async () => {
    const nlNap = { id: "nl-nap", name: "NL NAP", jurisdictions: ["NL"] };
    const rows = [...sources, sourceRow("nl-nap", nlNap)].map((row) =>
      row.id === "benelux-idro" || row.id === "nl-nap" ? { ...row, last_successful_at: null } : row,
    );
    const page = await renderCountryPage(summaryFor("NL", rows), origin);

    expect(page).toContain("publish machine-readable lists");
    expect(page).toContain("this directory has not retrieved them yet");
    expect(page).not.toContain("a machine-readable list");
    expect(page).not.toContain("holds no identifiers");
    expect(page).not.toContain("hold no identifiers");
  });

  it("does not call every list empty when only some have been retrieved", async () => {
    const nlNap = { id: "nl-nap", name: "NL NAP", jurisdictions: ["NL"] };
    const rows = [...sources, sourceRow("nl-nap", nlNap, { last_successful_at: null })];
    const page = await renderCountryPage(summaryFor("NL", rows), origin);

    expect(page).toContain("No published identifiers");
    expect(page).toContain("The lists retrieved so far hold no identifiers for Netherlands");
    expect(page).toContain("others have not been retrieved yet");
    expect(page).not.toContain("Its published list holds no identifiers");
  });

  it("counts only the sources that publish identifiers for the country", async () => {
    const stats = {
      ...irishStats,
      observations: irishStats.observations.filter((row) => row.source_id === "ie-tii"),
    };
    const page = await renderCountryPage(summaryFor("IE", sources, stats), origin);

    expect(page).toContain("published by 1 source.");
  });

  it("lists every authority and source covering a country", async () => {
    const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin);

    expect(page).toContain("Ireland");
    expect(page).toContain("Transport Infrastructure Ireland");
    expect(page).toContain("EV Roam");
    expect(page).toContain("gb-evroam");
    expect(page).toContain("ie-tii");
    expect(page).toContain("SECONDARY");
    expect(page).toContain('href="/explore/?country=IE"');
    expect(page).not.toContain("country-empty");
    // Fragment lists are joined without separators and escaped only once.
    expect(page).not.toMatch(/<\/(li|article|tr)>,/);
    expect(page).not.toContain("&lt;");
    expect(page).not.toContain("&amp;lt;");
  });

  it("points the canonical link at the lowercase path", async () => {
    const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin);

    expect(page).toContain('<link rel="canonical" href="https://directory.example/countries/ie/"');
  });

  it("loads only the explorer scripts, for a search section hidden without JavaScript", async () => {
    const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin);

    expect(scriptTags(page)).toEqual(SEARCH_SCRIPTS);
    expect(page).toMatch(
      /<section\s+class="[^"]*country-search[^"]*"[^>]*data-fixed-country="IE"[^>]*data-base-path="\/countries\/ie\/"[^>]*hidden\s*>/,
    );
    for (const id of ["explore-form", "query", "role", "status", "results", "detail-panel"]) {
      expect(page).toContain(`id="${id}"`);
    }
    expect(page).toContain('id="foreign-notice"');
    // The country is fixed text, never a control.
    expect(page).not.toContain('id="country"');
    // The explorer stays one link away for a search across countries.
    expect(page).toContain('href="/explore/?country=IE"');
  });

  it("renders no search section and no script for a country with nothing to search", async () => {
    const page = await renderCountryPage(summaryFor("CY"), origin);

    expect(scriptTags(page)).toEqual([]);
    expect(page).not.toContain("data-fixed-country");
    expect(page).not.toContain('id="explore-form"');
  });

  it("escapes upstream text", async () => {
    const hostile = { ...cyEms, name: '<script>alert("x")</script>' };
    const page = await renderCountryPage(summaryFor("CY", [sourceRow("cy-ems", hostile)]), origin);

    expect(scriptTags(page)).toEqual([]);
    expect(page).toContain("&lt;script&gt;");
  });

  it("escapes upstream text on a page that loads the search scripts", async () => {
    const hostile = { ...tii, name: '<script>alert("x")</script>' };
    const rows = sources.map((row) => (row.id === "ie-tii" ? sourceRow("ie-tii", hostile) : row));
    const page = await renderCountryPage(summaryFor("IE", rows, irishStats), origin);

    expect(scriptTags(page)).toEqual(SEARCH_SCRIPTS);
    expect(page).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("does not link upstream URLs whose scheme is not http(s)", async () => {
    const rows = [
      sourceRow("cy-ems", cyEms, {
        authority_homepage_url: "javascript:alert(1)",
        registry_url: "javascript:alert(2)",
      }),
    ];
    const page = await renderCountryPage(summaryFor("CY", rows), origin);

    expect(page).not.toContain('href="javascript:');
    expect(page).toContain("javascript:alert(2)");
  });

  it("renders error pages as HTML with the request id", async () => {
    const page = await renderErrorPage(404, "No source covers this country.", "req-1");

    expect(page).toContain("<!doctype html>");
    expect(page).toContain("No source covers this country.");
    expect(page).toContain("req-1");
    expect(page).toContain('href="/#pays"');
  });
});
