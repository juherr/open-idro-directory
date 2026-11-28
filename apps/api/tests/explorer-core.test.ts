import { describe, expect, it } from "vitest";
import {
  countryPagePath,
  createSearchScope,
  existingCountryPagePath,
  normalizeIdentifierInput,
} from "../public/explorer-core.js";

const emptyState = { q: "", country: "", role: "", status: "" };

describe("normalizeIdentifierInput", () => {
  it.each([
    ["FR-AB1", { countryCode: "FR", partyId: "AB1", emobilityId: "FRAB1" }],
    ["FR*AB1", { countryCode: "FR", partyId: "AB1", emobilityId: "FRAB1" }],
    ["frab1", { countryCode: "FR", partyId: "AB1", emobilityId: "FRAB1" }],
    ["  fr-ab1  ", { countryCode: "FR", partyId: "AB1", emobilityId: "FRAB1" }],
    ["FRA*B", { countryCode: "FR", partyId: "A*B", emobilityId: "FRA*B" }],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeIdentifierInput(input)).toEqual(expected);
  });

  it.each(["fr ab1", "FR-AB", "FR-AB12", "F1-AB1", "IONITY", "", "FR--AB1", "FR-A*B"])(
    "rejects %j",
    (input) => {
      expect(normalizeIdentifierInput(input)).toBeNull();
    },
  );
});

describe("explorer scope (characterization of /explore/)", () => {
  const scope = createSearchScope({ basePath: "/explore/" });

  it("defaults to the explorer base path", () => {
    expect(createSearchScope().buildPageUrl({ ...emptyState, q: "x" })).toBe("/explore/?q=x");
  });

  it("reads q, country, role and status verbatim from the search string", () => {
    expect(scope.readState("?q=%20ionity%20&country=DE&role=CPO&status=ACTIVE&x=1")).toEqual({
      q: " ionity ",
      country: "DE",
      role: "CPO",
      status: "ACTIVE",
    });
    expect(scope.readState("")).toEqual(emptyState);
  });

  it("builds the default parties path", () => {
    expect(scope.buildApiPath(emptyState)).toBe("/api/v1/parties?limit=25");
  });

  it("orders params country, role, status, q, limit and trims q", () => {
    expect(
      scope.buildApiPath({ q: "  ionity ", country: "DE", role: "CPO", status: "ACTIVE" }),
    ).toBe("/api/v1/parties?country=DE&role=CPO&status=ACTIVE&q=ionity&limit=25");
  });

  it("searches an identifier-looking query by emobilityId", () => {
    expect(scope.buildApiPath({ ...emptyState, q: "fr-ab1", role: "EMSP" })).toBe(
      "/api/v1/parties?role=EMSP&emobilityId=FRAB1&limit=25",
    );
  });

  it("appends the cursor last, only when given", () => {
    const state = { ...emptyState, q: "a b" };
    expect(scope.buildApiPath(state, "c1")).toBe("/api/v1/parties?q=a+b&limit=25&cursor=c1");
    expect(scope.buildApiPath(state, null)).toBe("/api/v1/parties?q=a+b&limit=25");
    expect(scope.buildApiPath(state, "")).toBe("/api/v1/parties?q=a+b&limit=25");
  });

  it("builds the page URL with q untrimmed and no question mark when empty", () => {
    expect(scope.buildPageUrl(emptyState)).toBe("/explore/");
    expect(
      scope.buildPageUrl({ q: " fr-ab1 ", country: "FR", role: "CPO", status: "ACTIVE" }),
    ).toBe("/explore/?q=+fr-ab1+&country=FR&role=CPO&status=ACTIVE");
    expect(scope.buildPageUrl({ ...emptyState, status: "RESERVED" })).toBe(
      "/explore/?status=RESERVED",
    );
  });

  it("resolves identifier-looking queries only", () => {
    expect(scope.resolvePath("FR*AB1")).toBe("/api/v1/resolve/FRAB1");
    expect(scope.resolvePath("FRA*B")).toBe("/api/v1/resolve/FRA*B");
    expect(scope.resolvePath("ionity")).toBeNull();
    expect(scope.resolvePath("")).toBeNull();
  });

  it("plans a search plus resolve for any identifier, whatever its country", () => {
    expect(scope.planQuery({ ...emptyState, q: "DE*ABC", country: "FR" })).toEqual({
      kind: "search",
      searchPath: "/api/v1/parties?country=FR&emobilityId=DEABC&limit=25",
      resolvePath: "/api/v1/resolve/DEABC",
    });
    expect(scope.planQuery({ ...emptyState, q: "ionity" })).toEqual({
      kind: "search",
      searchPath: "/api/v1/parties?q=ionity&limit=25",
      resolvePath: null,
    });
  });
});

describe("fixed-country scope", () => {
  const scope = createSearchScope({ fixedCountry: "fr", basePath: "/countries/fr/" });

  it("derives the country page as base path when none is given", () => {
    const derived = createSearchScope({ fixedCountry: "fr" });
    expect(derived.basePath).toBe("/countries/fr/");
    expect(derived.buildPageUrl(emptyState)).toBe("/countries/fr/");
    expect(derived.buildPageUrl({ ...emptyState, q: "x", role: "CPO" })).toBe(
      "/countries/fr/?q=x&role=CPO",
    );
  });

  it("falls back to the explorer path for an invalid fixed country", () => {
    const invalid = createSearchScope({ fixedCountry: "f1" });
    expect(invalid.basePath).toBe("/explore/");
    expect(invalid.buildPageUrl({ ...emptyState, q: "x" })).toBe("/explore/?q=x");
  });

  it("normalizes the fixed country to upper case", () => {
    expect(scope.fixedCountry).toBe("FR");
    expect(createSearchScope().fixedCountry).toBeNull();
  });

  it("ignores the country of the search string", () => {
    expect(scope.readState("?country=DE&q=x&role=CPO")).toEqual({
      q: "x",
      country: "FR",
      role: "CPO",
      status: "",
    });
  });

  it("always forces the fixed country into API paths", () => {
    expect(scope.buildApiPath(emptyState)).toBe("/api/v1/parties?country=FR&limit=25");
    expect(scope.buildApiPath({ ...emptyState, country: "DE", q: "x" }, "c2")).toBe(
      "/api/v1/parties?country=FR&q=x&limit=25&cursor=c2",
    );
  });

  it("never writes the country to the page URL", () => {
    expect(scope.buildPageUrl({ q: "x", country: "DE", role: "CPO", status: "ACTIVE" })).toBe(
      "/countries/fr/?q=x&role=CPO&status=ACTIVE",
    );
    expect(scope.buildPageUrl({ ...emptyState, country: "FR" })).toBe("/countries/fr/");
  });

  it("searches and resolves a same-country identifier as the explorer does", () => {
    expect(scope.planQuery({ ...emptyState, q: "fr*ab1", status: "ACTIVE" })).toEqual({
      kind: "search",
      searchPath: "/api/v1/parties?country=FR&status=ACTIVE&emobilityId=FRAB1&limit=25",
      resolvePath: "/api/v1/resolve/FRAB1",
    });
    expect(scope.resolvePath("FR-AB1")).toBe("/api/v1/resolve/FRAB1");
  });

  it("reports a foreign identifier instead of searching or resolving it", () => {
    expect(scope.planQuery({ ...emptyState, q: "de*abc" })).toEqual({
      kind: "foreign-identifier",
      countryCode: "DE",
      emobilityId: "DEABC",
    });
    expect(scope.resolvePath("DE*ABC")).toBeNull();
  });

  it("searches a plain text query within the fixed country", () => {
    expect(scope.planQuery({ ...emptyState, q: "ionity" })).toEqual({
      kind: "search",
      searchPath: "/api/v1/parties?country=FR&q=ionity&limit=25",
      resolvePath: null,
    });
  });

  it("never builds an API or resolve path for a foreign identifier", () => {
    expect(scope.buildApiPath({ ...emptyState, q: "DE*ABC" }, "c1")).toBeNull();
    expect(scope.buildApiPath({ ...emptyState, q: "DE-ABC" })).toBeNull();
    expect(scope.resolvePath("DE-ABC")).toBeNull();
  });
});

describe("fixed-country scope in a page language", () => {
  const french = createSearchScope({ fixedCountry: "fr", lang: "fr" });

  it("keeps lang=fr in the page URL of a French country page", () => {
    expect(french.buildPageUrl(emptyState)).toBe("/countries/fr/?lang=fr");
    expect(french.buildPageUrl({ q: "x", country: "DE", role: "CPO", status: "ACTIVE" })).toBe(
      "/countries/fr/?lang=fr&q=x&role=CPO&status=ACTIVE",
    );
  });

  it("keeps lang=fr after reading the page URL back", () => {
    const url = french.buildPageUrl({ ...emptyState, q: "ionity", status: "ACTIVE" });
    const state = french.readState(new URL(url, "https://example.test").search);
    expect(state).toEqual({ q: "ionity", country: "FR", role: "", status: "ACTIVE" });
    expect(french.buildPageUrl(state)).toBe(url);
  });

  it.each([["en"], [undefined], ["xx"]])(
    "adds no lang to the page URL for the language %j",
    (lang) => {
      const scope = createSearchScope({ fixedCountry: "fr", lang });
      expect(scope.buildPageUrl(emptyState)).toBe("/countries/fr/");
      expect(scope.buildPageUrl({ ...emptyState, q: "x", role: "CPO" })).toBe(
        "/countries/fr/?q=x&role=CPO",
      );
    },
  );

  it("leaves API paths and the explorer URL without lang", () => {
    expect(french.buildApiPath({ ...emptyState, q: "x" })).toBe(
      "/api/v1/parties?country=FR&q=x&limit=25",
    );
    const explorer = createSearchScope({ lang: "fr" });
    expect(explorer.buildPageUrl({ ...emptyState, q: "x" })).toBe("/explore/?q=x");
  });
});

describe("fixed-country scope with known countries", () => {
  const scope = createSearchScope({
    fixedCountry: "FR",
    basePath: "/countries/fr/",
    knownCountries: ["FR", "DE", "NL"],
  });

  it("searches a compact name with an unknown prefix as text in the fixed country", () => {
    expect(scope.planQuery({ ...emptyState, q: "TESLA" })).toEqual({
      kind: "search",
      searchPath: "/api/v1/parties?country=FR&q=TESLA&limit=25",
      resolvePath: null,
    });
    expect(scope.resolvePath("tesla")).toBeNull();
  });

  it("reports a compact identifier with a known foreign prefix", () => {
    expect(scope.planQuery({ ...emptyState, q: "deabc" })).toEqual({
      kind: "foreign-identifier",
      countryCode: "DE",
      emobilityId: "DEABC",
    });
    const path = scope.buildApiPath({ ...emptyState, q: "DEABC" }, "c1");
    expect(path ?? "").not.toContain("emobilityId=DE");
  });

  it.each(["XY*ABC", "XY-ABC", "DE*ABC"])(
    "reports %j, whose separator makes it an identifier, as foreign",
    (q) => {
      expect(scope.planQuery({ ...emptyState, q })).toMatchObject({
        kind: "foreign-identifier",
      });
      expect(scope.buildApiPath({ ...emptyState, q }, "c1")).toBeNull();
      expect(scope.resolvePath(q)).toBeNull();
    },
  );

  it("still searches and resolves a compact identifier of the fixed country", () => {
    expect(scope.planQuery({ ...emptyState, q: "frab1" })).toEqual({
      kind: "search",
      searchPath: "/api/v1/parties?country=FR&emobilityId=FRAB1&limit=25",
      resolvePath: "/api/v1/resolve/FRAB1",
    });
  });

  it("leaves the explorer unaffected by known countries", () => {
    const explorer = createSearchScope({ knownCountries: ["FR"] });
    expect(explorer.planQuery({ ...emptyState, q: "TESLA" })).toEqual({
      kind: "search",
      searchPath: "/api/v1/parties?emobilityId=TESLA&limit=25",
      resolvePath: "/api/v1/resolve/TESLA",
    });
  });
});

describe("countryPagePath", () => {
  it.each([
    ["FR", "/countries/fr/"],
    ["de", "/countries/de/"],
  ])("links %j to its country page", (code, expected) => {
    expect(countryPagePath(code)).toBe(expected);
  });

  it.each(["", "F", "FRA", "F1", "../", '"x', null, undefined])(
    "returns null for %j, which is not a country code",
    (code) => {
      expect(countryPagePath(code as string)).toBeNull();
    },
  );

  it.each([
    ["fr", "/countries/de/?lang=fr"],
    ["en", "/countries/de/"],
    [undefined, "/countries/de/"],
    ["xx", "/countries/de/"],
  ])("links in the language %j as %j", (lang, expected) => {
    expect(countryPagePath("DE", lang)).toBe(expected);
  });

  it("returns null for an invalid code whatever the language", () => {
    expect(countryPagePath("F1", "fr")).toBeNull();
  });
});

describe("existingCountryPagePath", () => {
  const counts = { DE: 3349, FR: 769, BG: 0 };

  it.each([
    ["DE", "/countries/de/"],
    ["de", "/countries/de/"],
    ["Fr", "/countries/fr/"],
  ])("links %j, counted in the stats, to its country page", (code, expected) => {
    expect(existingCountryPagePath(code, counts)).toBe(expected);
  });

  it.each(["IT", "it", "BG", "bg"])(
    "returns null for %j, which has no identifier and so no country page",
    (code) => {
      expect(existingCountryPagePath(code, counts)).toBeNull();
    },
  );

  it("returns null when the counts are unknown", () => {
    expect(existingCountryPagePath("DE", null)).toBeNull();
    expect(existingCountryPagePath("DE", {})).toBeNull();
  });

  it("returns null for a value that is not a country code", () => {
    expect(existingCountryPagePath("../", { "../": 1 })).toBeNull();
  });

  it("links in the page language", () => {
    expect(existingCountryPagePath("DE", counts, "fr")).toBe("/countries/de/?lang=fr");
    expect(existingCountryPagePath("DE", counts, "en")).toBe("/countries/de/");
    expect(existingCountryPagePath("IT", counts, "fr")).toBeNull();
  });
});

describe("planQuery search path", () => {
  // The explorer runs `searchPath` for a new search and `buildApiPath` with
  // a cursor for "load more": both must describe the same first page.
  const explorer = createSearchScope({ basePath: "/explore/" });
  const france = createSearchScope({ fixedCountry: "fr", basePath: "/countries/fr/" });

  it.each([
    ["explorer", { ...emptyState, q: "ionity" }, explorer],
    ["explorer", { ...emptyState, q: "DE*ABC" }, explorer],
    ["fixed-country", { ...emptyState, role: "CPO" }, france],
    ["fixed-country", { ...emptyState, q: "fr-ab1", status: "ACTIVE" }, france],
  ])("equals the first-page API path (%s scope, %j)", (_label, state, scope) => {
    const plan = scope.planQuery(state);
    expect(plan.kind).toBe("search");
    if (plan.kind !== "search") return;
    expect(plan.searchPath).toBe(scope.buildApiPath(state, null));
  });
});
