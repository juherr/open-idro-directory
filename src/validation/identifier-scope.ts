import { isAssignedCountryCode } from "../domain/country-code.js";
import { sourceJurisdictions, type SourceDefinition } from "../domain/source-definition.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

/**
 * A well-formed eMI3 identifier, whatever country it names. Connectors keep
 * their own stricter pattern for the format their register publishes; this one
 * only answers "is this a readable identifier at all".
 */
const ANY_IDENTIFIER = /^([A-Za-z]{2})\s*([*-]?)\s*([A-Za-z0-9]{3})$/;

export interface CrossRegisterIdentifier {
  countryCode: string;
  partyId: string;
  /** The separator the register used, `*`, `-` or none. */
  separator: string;
}

/**
 * Reads an identifier this register lists for another country, so a connector
 * can publish it as a cross-register listing instead of rejecting it. Returns
 * `null` for anything else: a covered country (whatever the connector disliked
 * is a format problem), an unreadable value, or a prefix naming no country.
 */
export function parseCrossRegisterIdentifier(
  source: SourceDefinition,
  value: string,
): CrossRegisterIdentifier | null {
  const match = ANY_IDENTIFIER.exec(value.trim());
  const countryCode = foreignCountryOf(source, value);
  if (!match || !countryCode) return null;
  return {
    countryCode,
    partyId: (match[3] ?? "").toUpperCase(),
    separator: match[2] ?? "",
  };
}

export interface RejectedIdentifier {
  /** Connector prefix of the reported code, for example `EIPA`. */
  codePrefix: string;
  /** What the value is, for example `EIPA identifier` or `AFIREV prefix`. */
  subject: string;
  /** The value as it appears in the message. */
  value: string;
  /** The value to report as unreadable, when it differs from the message one. */
  reported?: string;
}

export function coversJurisdiction(source: SourceDefinition, countryCode: string) {
  return sourceJurisdictions(source).includes(countryCode.toUpperCase());
}

/**
 * Reports a value the connector could not read. Connectors try
 * `parseCrossRegisterIdentifier` first, so another country's well-formed
 * identifier never lands here: it is published as a cross-register listing.
 */
export function rejectedIdentifierWarning(
  source: SourceDefinition,
  rejection: RejectedIdentifier,
): ValidationIssue {
  return {
    severity: "warning",
    sourceId: source.id,
    code: `${rejection.codePrefix}_MALFORMED_IDENTIFIER`,
    message: `Unexpected ${rejection.subject} syntax: ${rejection.value}`,
    rejectedIdentifier: rejection.reported ?? rejection.value,
  };
}

function foreignCountryOf(source: SourceDefinition, value: string) {
  const countryCode = ANY_IDENTIFIER.exec(value.trim())?.[1]?.toUpperCase();
  // A prefix naming no country, such as `ZZ`, is not another register's
  // identifier: it is a value nobody can resolve, and the rejection report is
  // where it belongs.
  if (!countryCode || !isAssignedCountryCode(countryCode)) return null;
  if (coversJurisdiction(source, countryCode)) return null;
  return countryCode;
}
