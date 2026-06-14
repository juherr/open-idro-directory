import type { SourceDefinition } from "../domain/source-definition.js";
import type { NormalizedRegistryRecord } from "../domain/registry-record.js";
import type { ValidationIssue } from "../domain/validation-issue.js";

export interface FetchContext {
  source: SourceDefinition;
  retrievedAt: string;
  userAgent: string;
  previousEtag?: string;
  previousLastModified?: string;
}

export interface FetchResult {
  status: "changed" | "unchanged";
  sourceId: string;
  body: string;
  contentType: string | null;
  finalUrl: string;
  httpStatus: number;
  retrievedAt: string;
  checksum: string;
  etag: string | null;
  lastModified: string | null;
}

export interface ParseInput {
  source: SourceDefinition;
  body: string;
  retrievedAt: string;
}

export interface ParseOutput<TRecord> {
  records: TRecord[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

export interface NormalizeInput<TRecord> {
  source: SourceDefinition;
  records: TRecord[];
  retrievedAt: string;
}

export interface NormalizeOutput {
  records: NormalizedRegistryRecord[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

export interface RegistryConnector<TRecord = unknown> {
  readonly sourceId: string;
  fetch(context: FetchContext): Promise<FetchResult>;
  parse(input: ParseInput): Promise<ParseOutput<TRecord>>;
  normalize(input: NormalizeInput<TRecord>): Promise<NormalizeOutput>;
}

export class NotImplementedError extends Error {
  constructor(sourceId: string) {
    super(`Connector ${sourceId} is not implemented yet.`);
    this.name = "NotImplementedError";
  }
}
