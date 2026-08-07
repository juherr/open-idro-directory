import { isAssignedCountryCode } from "../domain/country-code.js";
import { sourceJurisdictions, type SourceDefinition } from "../domain/source-definition.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

/**
 * A well-formed eMI3 identifier, whatever country it names. Connectors keep
 * their own stricter pattern for the format their register publishes; this one
 * only answers "is this a readable identifier at all".
 */
const ANY_IDENTIFIER = /^([A-Za-z]{2})\s*[*-]?\s*([A-Za-z0-9]{3})$/;

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
 * A national register listing another country's identifier is publishing
 * something it does not administer -- not a broken row. Reporting it as
 * unreadable sends a maintainer looking for a parser bug that does not exist,
 * and buries the genuinely malformed values it is meant to surface.
 */
export function rejectedIdentifierWarning(
  source: SourceDefinition,
  rejection: RejectedIdentifier,
): ValidationIssue {
  const foreign = foreignCountryOf(source, rejection.value);
  if (foreign) return outOfJurisdiction(source, rejection, foreign);
  return {
    severity: "warning",
    sourceId: source.id,
    code: `${rejection.codePrefix}_MALFORMED_IDENTIFIER`,
    message: `Unexpected ${rejection.subject} syntax: ${rejection.value}`,
    rejectedIdentifier: rejection.reported ?? rejection.value,
  };
}

/**
 * Reports an identifier this register does not cover. Connectors that accept
 * any country call it after parsing, so no source publishes records outside the
 * jurisdictions it declares.
 */
export function outOfJurisdictionWarning(
  source: SourceDefinition,
  rejection: Omit<RejectedIdentifier, "reported">,
  countryCode: string,
): ValidationIssue {
  return outOfJurisdiction(source, rejection, countryCode.toUpperCase());
}

function outOfJurisdiction(
  source: SourceDefinition,
  rejection: Omit<RejectedIdentifier, "reported">,
  countryCode: string,
): ValidationIssue {
  return {
    severity: "warning",
    sourceId: source.id,
    code: `${rejection.codePrefix}_OUT_OF_JURISDICTION_IDENTIFIER`,
    message: `${rejection.subject} ${rejection.value} belongs to ${countryCode}, outside the jurisdictions this register covers (${sourceJurisdictions(source).join(", ")}).`,
    // Reported verbatim, like the unreadable values: the register's own
    // spelling is the provenance.
    outOfJurisdictionIdentifier: { value: rejection.value, countryCode },
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
