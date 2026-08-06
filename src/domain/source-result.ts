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
  /**
   * When the source last answered. A run that failed carries the published
   * value over, because it still has to say when the registry was reachable.
   */
  lastSuccessfulRetrieval: string | null;
}
