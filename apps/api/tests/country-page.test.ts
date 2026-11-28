import { describe, expect, it } from "vitest";
import { countrySummaryPayload, type CountrySummary } from "../src/application/mappers.js";
import {
  COUNTRY_PAGE_COPY,
  pageLanguage,
  renderCountryPage,
  jsonLdScript,
  renderErrorPage,
} from "../src/http/pages/country-page.js";
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

const JSON_LD = '<script type="application/ld+json">';
const SEARCH_SCRIPTS = ['<script src="/shared.js">', '<script type="module" src="/explorer.js">'];

/** Every opening script tag of the page, in document order. */
function scriptTags(page: string) {
  return page.match(/<script\b[^>]*>/gi) ?? [];
}

/** The `content` of the first `<meta>` whose `attribute` is `name`. */
function metaContent(page: string, attribute: "name" | "property", name: string) {
  const tags = page.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) => candidate.includes(`${attribute}="${name}"`));
  return tag?.match(/content="([^"]*)"/)?.[1] ?? null;
}

function canonicalOf(page: string) {
  return page.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? null;
}

/** The `hreflang` alternates of the page, as `[hreflang, href]` pairs. */
function alternatesOf(page: string) {
  return [...page.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)"/g)].map(
    ([, hreflang, href]) => [hreflang, href],
  );
}

/** The parsed JSON-LD blocks of the page. */
function jsonLdOf(page: string): unknown[] {
  return [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    ([, json]) => JSON.parse(json ?? ""),
  );
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
    expect(page).toContain("Secondary");
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

  it("loads only the breadcrumbs and the explorer scripts, for a search section hidden without JavaScript", async () => {
    const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin);

    expect(scriptTags(page)).toEqual([JSON_LD, ...SEARCH_SCRIPTS]);
    expect(page).toMatch(
      /<section\s+class="[^"]*country-search[^"]*"[^>]*data-fixed-country="IE"[^>]*hidden\s*>/,
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

  it("renders no search section and no search script for a country with nothing to search", async () => {
    const page = await renderCountryPage(summaryFor("CY"), origin);

    expect(scriptTags(page)).toEqual([JSON_LD]);
    expect(page).not.toContain("data-fixed-country");
    expect(page).not.toContain('id="explore-form"');
  });

  it("escapes upstream text", async () => {
    const hostile = { ...cyEms, name: '<script>alert("x")</script>' };
    const page = await renderCountryPage(summaryFor("CY", [sourceRow("cy-ems", hostile)]), origin);

    expect(scriptTags(page)).toEqual([JSON_LD]);
    expect(page).toContain("&lt;script&gt;");
  });

  it("escapes upstream text on a page that loads the search scripts", async () => {
    const hostile = { ...tii, name: '<script>alert("x")</script>' };
    const rows = sources.map((row) => (row.id === "ie-tii" ? sourceRow("ie-tii", hostile) : row));
    const page = await renderCountryPage(summaryFor("IE", rows, irishStats), origin);

    expect(scriptTags(page)).toEqual([JSON_LD, ...SEARCH_SCRIPTS]);
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

  it("labels statuses, authority levels, observation types and freshness", async () => {
    const stats = {
      ...irishStats,
      statuses: [...irishStats.statuses, { key: "REVOKED", count: 2 }],
    };
    const page = await renderCountryPage(summaryFor("IE", sources, stats), origin);

    expect(page).toContain("Active: 80, Revoked: 2");
    expect(page).toContain("Secondary");
    expect(page).toContain("Official assignment");
    expect(page).toContain("Stale");
    expect(page).not.toContain("OFFICIAL_ASSIGNMENT");
  });

  it("renders error pages as HTML with the request id", async () => {
    const page = await renderErrorPage(404, "No source covers this country.", "req-1");

    expect(page).toContain("<!doctype html>");
    expect(page).toContain("No source covers this country.");
    expect(page).toContain("req-1");
    expect(page).toContain('href="/#pays"');
  });

  it("loads no script on an error page", async () => {
    const page = await renderErrorPage(404, "No source covers this country.", "req-1");

    expect(scriptTags(page)).toEqual([]);
  });

  it("keeps error pages in English", async () => {
    const page = await renderErrorPage(404, "No source covers this country.", "req-1");

    expect(page).toContain('<html lang="en">');
  });
});

/** Every key path of a dictionary, nested objects included. */
function keyPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, entry]) =>
    entry && typeof entry === "object"
      ? keyPaths(entry as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("country page localization", () => {
  it("gives the French and English dictionaries exactly the same keys", () => {
    const en = keyPaths(COUNTRY_PAGE_COPY.en).sort();
    expect(en.length).toBeGreaterThan(50);
    expect(keyPaths(COUNTRY_PAGE_COPY.fr).sort()).toEqual(en);
  });

  it.each([
    ["fr", "fr"],
    ["en", "en"],
    [null, "en"],
    ["", "en"],
    ["xx", "en"],
    ["FR-fr", "en"],
  ])("reads the page language %j as %j", (value, expected) => {
    expect(pageLanguage(value)).toBe(expected);
  });

  it("renders a published country in French", async () => {
    const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin, "fr");

    expect(page).toContain('<html lang="fr">');
    expect(page).toContain("Irlande");
    expect(page).toContain("Autorités IDRO");
    expect(page).toContain("Couverture");
    expect(page).toContain("Type d&#39;observation");
    expect(page).toContain("Attribution officielle");
    expect(page).toContain("Secondaire");
    expect(page).toContain("Rechercher des identifiants");
    expect(page).toContain("Charger plus");
    expect(page).toContain("projet d&#39;agrégation indépendant");
    expect(page).toContain(
      `${new Intl.NumberFormat("fr").format(80)} identifiants publiés par 2 sources.`,
    );
    for (const english of [
      "IDRO authorities",
      "Coverage",
      "Declared roles",
      "Freshness",
      "Observation type",
      "Last successful retrieval",
      "Search identifiers",
      "Load more",
      "This summary as JSON",
      ">Countries<",
      "independent aggregation project",
      "Official assignment",
    ]) {
      expect(page).not.toContain(english);
    }
  });

  it("formats French counts with the French number format", async () => {
    const stats = { ...irishStats, statuses: [{ key: "ACTIVE", count: 12345 }] };
    const page = await renderCountryPage(summaryFor("IE", sources, stats), origin, "fr");

    expect(page).toContain(`Actif : ${new Intl.NumberFormat("fr").format(12345)}`);
  });

  it("treats a single identifier and source as singular in French", async () => {
    const stats = {
      ...irishStats,
      statuses: [{ key: "ACTIVE", count: 1 }],
      observations: irishStats.observations.filter((row) => row.source_id === "ie-tii"),
    };
    const page = await renderCountryPage(summaryFor("IE", sources, stats), origin, "fr");

    expect(page).toContain("1 identifiant publié par 1 source.");
  });

  it("explains an empty country in French without naming it in a sentence", async () => {
    const page = await renderCountryPage(summaryFor("IE"), origin, "fr");

    expect(page).toContain("Aucun identifiant publié");
    expect(page).toContain(
      "EV Roam et Transport Infrastructure Ireland gèrent les identifiants de mobilité électrique de ce pays.",
    );
    expect(page).toContain(
      "Leurs listes publiées ne contiennent encore aucun identifiant de ce pays",
    );
    expect(page).toContain("adressez-vous aux autorités ci-dessous");
    expect(page).not.toContain("No published identifiers");
    expect(page).not.toContain("invalide");
  });

  it("explains a country without a published list in French", async () => {
    const page = await renderCountryPage(summaryFor("CY"), origin, "fr");

    expect(page).toContain("Chypre");
    expect(page).toContain("ne publie aucune liste lisible par machine");
    expect(page).toContain("adressez-vous à l&#39;autorité ci-dessous");
  });
});

describe("country page metadata", () => {
  const english = "https://directory.example/countries/ie/";
  const french = "https://directory.example/countries/ie/?lang=fr";

  it.each([
    ["en" as const, english, "en_GB", "fr_FR", "Ireland"],
    ["fr" as const, french, "fr_FR", "en_GB", "Irlande"],
  ])(
    "gives the %s page its canonical, alternates and Open Graph tags",
    async (lang, canonical, locale, alternateLocale, name) => {
      const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin, lang);

      expect(canonicalOf(page)).toBe(canonical);
      expect(alternatesOf(page)).toEqual([
        ["en", english],
        ["fr", french],
        ["x-default", english],
      ]);
      expect(metaContent(page, "property", "og:url")).toBe(canonical);
      expect(metaContent(page, "property", "og:type")).toBe("website");
      expect(metaContent(page, "property", "og:site_name")).toBe("Open IDRO Directory");
      expect(metaContent(page, "property", "og:locale")).toBe(locale);
      expect(metaContent(page, "property", "og:locale:alternate")).toBe(alternateLocale);
      expect(metaContent(page, "property", "og:title")).toContain(name);
      const description = metaContent(page, "name", "description");
      expect(description).toContain(name);
      expect(metaContent(page, "property", "og:description")).toBe(description);
    },
  );

  it("describes the country from its authorities and coverage", async () => {
    const en = await renderCountryPage(summaryFor("IE", sources, irishStats), origin);
    const fr = await renderCountryPage(summaryFor("IE", sources, irishStats), origin, "fr");

    expect(metaContent(en, "name", "description")).toContain("80 identifiers published by");
    expect(metaContent(en, "name", "description")).toContain("Transport Infrastructure Ireland");
    expect(metaContent(fr, "name", "description")).toContain("publiés par");
    expect(metaContent(fr, "name", "description")).toContain("Transport Infrastructure Ireland");
  });

  it.each([
    ["en" as const, french, "fr", "Lire en français"],
    ["fr" as const, english, "en", "Read in English"],
  ])("links the %s page to the other language", async (lang, href, hreflang, text) => {
    const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin, lang);

    expect(page).toContain(`<a href="${href}" hreflang="${hreflang}" lang="${hreflang}"`);
    expect(page).toContain(text);
  });

  it.each([
    ["en" as const, "Home", "Countries", "Ireland", english],
    ["fr" as const, "Accueil", "Pays", "Irlande", french],
  ])("describes the %s page breadcrumbs as JSON-LD", async (lang, home, countries, name, url) => {
    const page = await renderCountryPage(summaryFor("IE", sources, irishStats), origin, lang);

    expect(jsonLdOf(page)).toEqual([
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: home, item: "https://directory.example/" },
          {
            "@type": "ListItem",
            position: 2,
            name: countries,
            item: "https://directory.example/#pays",
          },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      },
    ]);
  });

  it("keeps the head of an error page free of country metadata", async () => {
    const page = await renderErrorPage(404, "No source covers this country.", "req-1");

    expect(canonicalOf(page)).toBeNull();
    expect(alternatesOf(page)).toEqual([]);
    expect(metaContent(page, "name", "description")).toBeNull();
    expect(jsonLdOf(page)).toEqual([]);
  });
});

describe("JSON-LD serialization", () => {
  it("cannot be closed by a value containing a script end tag", async () => {
    const hostile = { name: '</script><script>alert("x")</script><!--' };
    const block: string = await jsonLdScript(hostile);

    expect(scriptTags(block)).toEqual([JSON_LD]);
    expect(block.match(/<\/script>/gi)).toHaveLength(1);
    expect(block).not.toContain("<!--");
    expect(jsonLdOf(block)).toEqual([hostile]);
  });
});
