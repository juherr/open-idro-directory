import { z } from "zod";

// eMI3 / ISO 15118 assign a two-letter country code and a party ID of exactly
// three uppercase alphanumeric characters. These patterns are the single source
// of truth for identifier validity across the pipeline.
export const EMI3_COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
export const EMI3_PARTY_ID_PATTERN = /^[A-Z0-9]{3}$/;
export const EMI3_IDENTIFIER_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;

export const emi3CountryCodeSchema = z.string().regex(EMI3_COUNTRY_CODE_PATTERN);
export const emi3PartyIdSchema = z.string().regex(EMI3_PARTY_ID_PATTERN);
export const emi3IdentifierSchema = z.string().regex(EMI3_IDENTIFIER_PATTERN);

export type Emi3ValidityReason = "INVALID_COUNTRY" | "INVALID_PARTY_ID";

export interface Emi3IdentifierParts {
  countryCode: string;
  partyId: string;
}

export function emi3IdentifierReasons(identifier: Emi3IdentifierParts): Emi3ValidityReason[] {
  const reasons: Emi3ValidityReason[] = [];
  if (!EMI3_COUNTRY_CODE_PATTERN.test(identifier.countryCode)) reasons.push("INVALID_COUNTRY");
  if (!EMI3_PARTY_ID_PATTERN.test(identifier.partyId)) reasons.push("INVALID_PARTY_ID");
  return reasons;
}

export function isValidEmi3Identifier(identifier: Emi3IdentifierParts) {
  return emi3IdentifierReasons(identifier).length === 0;
}
