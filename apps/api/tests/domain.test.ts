import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../src/domain/cursor.js";
import { ifNoneMatchMatches, makeEtag } from "../src/domain/etag.js";
import { parseEmobilityIdentifierInput } from "../src/domain/identifier.js";

describe("API domain helpers", () => {
  it("round-trips cursors", () => {
    const encoded = encodeCursor({ countryCode: "FR", partyId: "ABC" });
    expect(decodeCursor(encoded ?? undefined)).toEqual({ countryCode: "FR", partyId: "ABC" });
  });

  it("creates stable ETags from canonical query parameters", async () => {
    await expect(makeEtag("checksum", "https://example.test/api/v1/parties?b=2&a=1")).resolves.toBe(
      await makeEtag("checksum", "https://example.test/api/v1/parties?a=1&b=2"),
    );
  });

  it.each([
    ['"abc"', true],
    ['"zzz", "abc"', true],
    ['"a,b", "abc"', true],
    ['"zzz","abc"', true],
    ["*", true],
    [" * ", true],
    ['W/"abc"', true],
    ['"zzz", W/"abc"', true],
    ['"zzz", "abcd"', false],
    ['"a,abc"', false],
    ["", false],
    [undefined, false],
  ])("matches If-None-Match %j against the current ETag: %s", (header, expected) => {
    expect(ifNoneMatchMatches(header, '"abc"')).toBe(expected);
  });

  it("normalizes common e-mobility identifier separators", () => {
    expect(parseEmobilityIdentifierInput("FR026")).toEqual({
      countryCode: "FR",
      partyId: "026",
      emobilityId: "FR026",
    });
    expect(parseEmobilityIdentifierInput("FR*026")).toEqual({
      countryCode: "FR",
      partyId: "026",
      emobilityId: "FR026",
    });
    expect(parseEmobilityIdentifierInput("FR-026")).toEqual({
      countryCode: "FR",
      partyId: "026",
      emobilityId: "FR026",
    });
  });
});
