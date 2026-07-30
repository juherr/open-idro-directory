import { describe, expect, it } from "vitest";
import { emi3IdentifierReasons, isValidEmi3Identifier } from "../../src/domain/emi3-identifier.js";

describe("eMI3 identifier validity", () => {
  it("accepts uppercase alphanumeric party IDs of exactly three characters", () => {
    expect(emi3IdentifierReasons({ countryCode: "SE", partyId: "ABC" })).toEqual([]);
    expect(emi3IdentifierReasons({ countryCode: "FR", partyId: "A1B" })).toEqual([]);
    expect(emi3IdentifierReasons({ countryCode: "DE", partyId: "000" })).toEqual([]);
  });

  it("rejects party IDs that are not exactly three uppercase alphanumeric characters", () => {
    for (const partyId of ["AB", "ABCD", "abc", "A-B", "A B", "A*B", ""]) {
      expect(emi3IdentifierReasons({ countryCode: "SE", partyId })).toEqual(["INVALID_PARTY_ID"]);
    }
  });

  it("rejects country codes that are not two uppercase letters", () => {
    for (const countryCode of ["S", "SWE", "se", "S1", ""]) {
      expect(emi3IdentifierReasons({ countryCode, partyId: "ABC" })).toEqual(["INVALID_COUNTRY"]);
    }
  });

  it("reports both reasons in a stable order when the whole identifier is invalid", () => {
    expect(emi3IdentifierReasons({ countryCode: "swe", partyId: "ALEG" })).toEqual([
      "INVALID_COUNTRY",
      "INVALID_PARTY_ID",
    ]);
  });

  it("exposes a boolean helper consistent with the reason list", () => {
    expect(isValidEmi3Identifier({ countryCode: "SE", partyId: "ABC" })).toBe(true);
    expect(isValidEmi3Identifier({ countryCode: "SE", partyId: "ALEG" })).toBe(false);
  });
});
