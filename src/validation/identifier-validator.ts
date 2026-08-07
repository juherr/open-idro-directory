import { emi3IdentifierReasons } from "../domain/emi3-identifier.js";
import type {
  InvalidRegistryRecordDetection,
  NormalizedRegistryRecord,
  OutOfJurisdictionDetection,
  RejectedSourceRowDetection,
} from "../domain/registry-record.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

const IDENTIFIER_REASON_MESSAGES = {
  INVALID_COUNTRY: "Invalid country code.",
  INVALID_PARTY_ID: "Party ID must be exactly three uppercase alphanumeric characters.",
} as const;

// Splits records on eMI3 identifier validity so the build can publish the valid
// ones and report the rest as counters instead of registry entries.
export function partitionRecordsByIdentifierValidity(records: NormalizedRegistryRecord[]) {
  const valid: NormalizedRegistryRecord[] = [];
  const invalid: InvalidRegistryRecordDetection[] = [];
  for (const record of records) {
    const reasons = emi3IdentifierReasons(record);
    if (reasons.length === 0) valid.push(record);
    else invalid.push({ reasons, record });
  }
  return { valid, invalid };
}

// Connector issues carrying a rejected raw value are the earlier half of the
// same story as the invalid records: rows the pipeline refused to publish.
export function toRejectedSourceRows(
  registryId: string,
  issues: ValidationIssue[],
): RejectedSourceRowDetection[] {
  return issues.flatMap((issue) =>
    issue.rejectedIdentifier === undefined
      ? []
      : [
          {
            registryId,
            code: issue.code,
            sourceValue: issue.rejectedIdentifier,
            message: issue.message,
          },
        ],
  );
}

// A register publishing another country's identifier is a finding to raise with
// its operator, not a defect to discard: it is collected so the registers
// concerned can be told, and so a later correction stays visible.
export function toOutOfJurisdictionRows(
  registryId: string,
  issues: ValidationIssue[],
): OutOfJurisdictionDetection[] {
  return issues.flatMap((issue) =>
    issue.outOfJurisdictionIdentifier === undefined
      ? []
      : [
          {
            registryId,
            code: issue.code,
            sourceValue: issue.outOfJurisdictionIdentifier.value,
            countryCode: issue.outOfJurisdictionIdentifier.countryCode,
            message: issue.message,
          },
        ],
  );
}

export function validateRecord(record: NormalizedRegistryRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!record.source.registryId)
    issues.push(error("EMPTY_REGISTRY", "Source registry is empty.", record.key));
  for (const reason of emi3IdentifierReasons(record)) {
    issues.push(error(reason, IDENTIFIER_REASON_MESSAGES[reason], record.key));
  }
  if (!record.organization.name)
    issues.push(error("EMPTY_ORGANIZATION", "Organization name is empty.", record.key));
  try {
    new URL(record.source.sourceUrl);
  } catch {
    issues.push(error("INVALID_SOURCE_URL", "Source URL is invalid.", record.key));
  }
  for (const [field, value] of Object.entries({
    firstSeenAt: record.source.firstSeenAt,
    lastSeenAt: record.source.lastSeenAt,
    retrievedAt: record.source.retrievedAt,
  })) {
    if (Number.isNaN(Date.parse(value)))
      issues.push(error("INVALID_TIMESTAMP", `${field} is invalid.`, record.key));
  }
  return issues;
}

function error(code: string, message: string, recordKey: string): ValidationIssue {
  return { severity: "error", code, message, recordKey };
}
