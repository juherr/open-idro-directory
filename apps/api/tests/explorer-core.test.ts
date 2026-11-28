import { describe, expect, it } from "vitest";
import {
  countryPagePath,
  createSearchScope,
  isIdentifierLike,
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
    expect(isIdentifierLike(input)).toBe(true);
  });

  it.each(["fr ab1", "FR-AB", "FR-AB12", "F1-AB1", "IONITY", "", "FR--AB1", "FR-A*B"])(
    "rejects %j",
    (input) => {
      expect(normalizeIdentifierInput(input)).toBeNull();
      expect(isIdentifierLike(input)).toBe(false);
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
});
