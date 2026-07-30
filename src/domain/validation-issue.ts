export type ValidationSeverity = "warning" | "error";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  sourceId?: string;
  recordKey?: string;
  // Raw upstream value a connector could not split into a country code and a
  // party ID. Its presence marks the issue as a rejected source row, so the
  // build reports it without matching on connector-specific issue codes.
  rejectedIdentifier?: string;
}
