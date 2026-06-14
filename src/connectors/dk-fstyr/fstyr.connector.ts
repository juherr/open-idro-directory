import type {
  FetchContext,
  FetchResult,
  NormalizeInput,
  NormalizeOutput,
  ParseInput,
  ParseOutput,
  RegistryConnector,
} from "../connector.js";
import {
  makeRegistryKey,
  type NormalizedRegistryRecord,
  type RegistryRole,
} from "../../domain/registry-record.js";
import { getText } from "../../infrastructure/http/http-client.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseFstyrHtml } from "./fstyr.parser.js";
import type { FstyrHtmlRow } from "./fstyr.types.js";

const SOURCE_HOSTS = ["www.danishroadtrafficauthority.dk"];

export class FstyrConnector implements RegistryConnector<FstyrHtmlRow> {
  readonly sourceId = "dk-fstyr";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const conditionals = {
      ...(context.previousEtag ? { etag: context.previousEtag } : {}),
      ...(context.previousLastModified ? { lastModified: context.previousLastModified } : {}),
    };
    const response = await getText(
      context.source.registryUrl,
      {
        timeoutMs: 30_000,
        retries: 2,
        maxBytes: 1_000_000,
        allowedHosts: SOURCE_HOSTS,
        userAgent: context.userAgent,
        headers: {
          Accept: "text/html,*/*",
        },
      },
      conditionals,
    );
    return {
      status: response.status === 304 ? "unchanged" : "changed",
      sourceId: this.sourceId,
      body: response.body,
      contentType: response.contentType,
      finalUrl: response.finalUrl,
      httpStatus: response.status,
      retrievedAt: context.retrievedAt,
      checksum: response.checksum,
      etag: response.etag,
      lastModified: response.lastModified,
    };
  }

  async parse(input: ParseInput): Promise<ParseOutput<FstyrHtmlRow>> {
    try {
      return parseFstyrHtml(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "FSTYR_INVALID_HTML",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<FstyrHtmlRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const organizationName =
        clean(sourceRecord.companyName) ?? "Unspecified Danish IDRO organization";
      const identifiers = [
        ...sourceRecord.cpoIds.map((sourceValue) => ({ role: "CPO" as const, sourceValue })),
        ...sourceRecord.emspIds.map((sourceValue) => ({ role: "EMSP" as const, sourceValue })),
      ];

      for (const identifier of identifiers) {
        const parsed = parseFstyrIdentifier(identifier.sourceValue);
        if (!parsed) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "FSTYR_MALFORMED_IDENTIFIER",
            message: `Unexpected Danish IDRO identifier syntax: ${identifier.sourceValue}`,
          });
          continue;
        }

        const key = makeRegistryKey(
          input.source.id,
          parsed.countryCode,
          parsed.partyId,
          identifier.role,
        );
        if (seen.has(key)) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "FSTYR_DUPLICATE_IDENTIFIER",
            message: `Duplicate Danish IDRO identifier ${identifier.sourceValue} for ${identifier.role}.`,
          });
          continue;
        }
        seen.add(key);

        records.push({
          key,
          countryCode: parsed.countryCode,
          partyId: parsed.partyId,
          eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
          role: identifier.role satisfies RegistryRole,
          status: "ACTIVE" as const,
          organization: {
            name: organizationName,
            legalName: organizationName,
            website: null,
          },
          source: {
            registryId: input.source.id,
            official: input.source.official,
            sourceRecordId: `${parsed.countryCode}${parsed.partyId}`,
            sourceUrl: input.source.registryUrl,
            sourceValue: identifier.sourceValue,
            firstSeenAt: input.retrievedAt,
            lastSeenAt: input.retrievedAt,
            retrievedAt: input.retrievedAt,
          },
          metadata: {
            fstyrCompanyName: organizationName,
            fstyrCvr: sourceRecord.cvr,
            fstyrSeparator: parsed.separator,
          },
        });
      }
    }
    return { records, warnings, errors };
  }
}

function parseFstyrIdentifier(value: string) {
  const match = /^(DK)\s*([*-])\s*([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "DK",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
