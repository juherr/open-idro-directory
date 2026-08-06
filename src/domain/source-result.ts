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
   * When the source last answered, carried over from the published summary. A
   * run that failed still has to say when the registry was last reachable.
   */
  lastSuccessfulRetrieval?: string | null;
}
