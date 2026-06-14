export type ValidationSeverity = "warning" | "error";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  sourceId?: string;
  recordKey?: string;
}
