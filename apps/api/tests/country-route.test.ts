import { describe, expect, it } from "vitest";
import { resolveCountryPage } from "../src/http/country-route.js";

function resolve(pathAndQuery: string) {
  return resolveCountryPage(new URL(`https://example.test${pathAndQuery}`));
}

describe("country page routing", () => {
  it("renders the canonical lowercase path", () => {
    expect(resolve("/countries/fr/")).toEqual({ kind: "render", countryCode: "FR" });
  });

  it("keeps query parameters other than country on the canonical path", () => {
    expect(resolve("/countries/fr/?q=total")).toEqual({ kind: "render", countryCode: "FR" });
  });

  it.each([
    ["/countries/FR/", "/countries/fr/"],
    ["/countries/Fr/", "/countries/fr/"],
    ["/countries/fr", "/countries/fr/"],
    ["/countries/FR", "/countries/fr/"],
    ["/countries/fr/?country=FR", "/countries/fr/"],
    ["/countries/fr/?country=fr", "/countries/fr/"],
    ["/countries/fr/?country=", "/countries/fr/"],
    ["/countries/FR/?q=total&country=FR&role=CPO", "/countries/fr/?q=total&role=CPO"],
  ])("redirects %s to %s", (path, location) => {
    expect(resolve(path)).toEqual({ kind: "redirect", location });
  });

  it.each([
    "/countries/fr/?country=DE",
    "/countries/FR/?country=DE",
    "/countries/fr?country=de",
    "/countries/fr/?country=FR&country=DE",
    "/countries/fr/?country=FRA",
  ])("rejects the conflicting country parameter in %s", (path) => {
    expect(resolve(path)).toEqual({ kind: "conflict" });
  });

  it.each([
    "/countries",
    "/countries/",
    "/countries/fra/",
    "/countries/f1/",
    "/countries/f/",
    "/countries/fr/extra",
    "/countries/fr//",
  ])("does not route %s", (path) => {
    expect(resolve(path)).toEqual({ kind: "not-found" });
  });
});
