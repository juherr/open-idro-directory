import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { SourceDefinition } from "../domain/source-definition.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

export function checkSafetyThresholds(
  source: SourceDefinition,
  previous: NormalizedRegistryRecord[],
  current: NormalizedRegistryRecord[],
  parseErrors: number,
  rawBody: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (previous.length > 0 && current.length === 0) {
    issues.push(error("SOURCE_BECAME_EMPTY", `${source.id} became empty.`));
  }
  const removed = previous.filter(
    (record) => !current.some((candidate) => candidate.key === record.key),
  );
  const changed = current.filter((record) => {
    const old = previous.find((candidate) => candidate.key === record.key);
    return old && JSON.stringify(stableRecord(old)) !== JSON.stringify(stableRecord(record));
  });
  if (previous.length > 0 && removed.length / previous.length > source.safety.maxDeletionRatio) {
    issues.push(
      error("MASS_DELETION", `${removed.length} of ${previous.length} records disappeared.`),
    );
  }
  if (previous.length > 0 && changed.length / previous.length > source.safety.maxChangeRatio) {
    issues.push(error("MASS_CHANGE", `${changed.length} of ${previous.length} records changed.`));
  }
  const totalRows = current.length + parseErrors;
  if (totalRows > 0 && parseErrors / totalRows > source.safety.maxParseErrorRatio) {
    issues.push(error("PARSE_ERROR_THRESHOLD", `${parseErrors} parse errors exceeded threshold.`));
  }
  if (looksLikeFallback(rawBody)) {
    issues.push(
      error(
        "SOURCE_FALLBACK_PAGE",
        `${source.id} response looks like a fallback or access-control page.`,
      ),
    );
  }
  return issues;
}

function stableRecord(record: NormalizedRegistryRecord) {
  return {
    ...record,
    source: {
      ...record.source,
      firstSeenAt: "",
      lastSeenAt: "",
      retrievedAt: "",
    },
  };
}

function looksLikeFallback(body: string) {
  const sample = body.slice(0, 5000).toLowerCase();
  return (
    sample.includes("captcha") ||
    sample.includes("cloudflare") ||
    sample.includes("please log in") ||
    sample.includes("please sign in") ||
    sample.includes("authentication required") ||
    sample.includes("access denied") ||
    sample.includes("forbidden") ||
    sample.includes("se connecter")
  );
}

function error(code: string, message: string): ValidationIssue {
  return { severity: "error", code, message };
}
