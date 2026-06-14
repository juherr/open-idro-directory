import type { NormalizedRegistryRecord } from "./registry-record.js";
import type { ValidationIssue } from "./validation-issue.js";

export interface SourceBuildResult {
  sourceId: string;
  records: NormalizedRegistryRecord[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  retrievedAt: string | null;
  checksum: string | null;
  stale: boolean;
  latestError: string | null;
}
