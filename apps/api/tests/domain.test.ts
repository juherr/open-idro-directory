import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../src/domain/cursor.js";
import { makeEtag } from "../src/domain/etag.js";
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
