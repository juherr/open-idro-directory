import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

export function validateRecord(record: NormalizedRegistryRecord): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!record.source.registryId)
    issues.push(error("EMPTY_REGISTRY", "Source registry is empty.", record.key));
  if (!/^[A-Z]{2}$/.test(record.countryCode))
    issues.push(error("INVALID_COUNTRY", "Invalid country code.", record.key));
  if (!record.partyId) issues.push(error("EMPTY_PARTY_ID", "Party ID is empty.", record.key));
  if (!/^[A-Z0-9]{2,8}$/.test(record.partyId)) {
    issues.push(warn("UNCOMMON_PARTY_ID", "Party ID has uncommon syntax.", record.key));
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

function warn(code: string, message: string, recordKey: string): ValidationIssue {
  return { severity: "warning", code, message, recordKey };
}
