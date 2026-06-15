import type {
  FetchContext,
  FetchResult,
  NormalizeInput,
  NormalizeOutput,
  ParseInput,
  ParseOutput,
  RegistryConnector,
} from "../connector.js";
import { makeRegistryKey, type NormalizedRegistryRecord } from "../../domain/registry-record.js";
import { getText } from "../../infrastructure/http/http-client.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseElectrokinisiHtml } from "./electrokinisi.parser.js";
import type { ElectrokinisiHtmlRow } from "./electrokinisi.types.js";

const SOURCE_HOSTS = ["electrokinisi.yme.gov.gr"];

export class ElectrokinisiConnector implements RegistryConnector<ElectrokinisiHtmlRow> {
  readonly sourceId = "gr-electrokinisi";

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
        maxBytes: 3_000_000,
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

  async parse(input: ParseInput): Promise<ParseOutput<ElectrokinisiHtmlRow>> {
    try {
      return parseElectrokinisiHtml(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "ELECTROKINISI_INVALID_HTML",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<ElectrokinisiHtmlRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      if (sourceRecord.role === "OTHER") continue;
      const parsed = parseElectrokinisiIdentifier(sourceRecord.sourceValue);
      if (!parsed) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "ELECTROKINISI_MALFORMED_IDENTIFIER",
          message: `Unexpected Greek IDRO identifier syntax: ${sourceRecord.sourceValue}`,
        });
        continue;
      }

      const key = makeRegistryKey(
        input.source.id,
        parsed.countryCode,
        parsed.partyId,
        sourceRecord.role,
      );
      if (seen.has(key)) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "ELECTROKINISI_DUPLICATE_IDENTIFIER",
          message: `Duplicate Greek IDRO identifier ${sourceRecord.sourceValue} for ${sourceRecord.role}.`,
        });
        continue;
      }
      seen.add(key);

      const organizationName =
        sourceRecord.organizationName ?? "Unspecified Hellenic IDRO organization";
      records.push({
        key,
        countryCode: parsed.countryCode,
        partyId: parsed.partyId,
        eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
        role: sourceRecord.role,
        status: "ACTIVE" as const,
        organization: {
          name: organizationName,
          legalName: organizationName,
          website: sourceRecord.website,
        },
        source: {
          registryId: input.source.id,
          official: input.source.official,
          sourceRecordId: `${parsed.countryCode}${parsed.partyId}`,
          sourceUrl: input.source.registryUrl,
          sourceValue: sourceRecord.sourceValue,
          firstSeenAt: input.retrievedAt,
          lastSeenAt: input.retrievedAt,
          retrievedAt: input.retrievedAt,
        },
        metadata: {
          electrokinisiCompanyName: organizationName,
          electrokinisiEmail: sourceRecord.email,
          electrokinisiSourceRole: sourceRecord.sourceRole,
          electrokinisiSeparator: parsed.separator,
        },
      });
    }

    return { records, warnings, errors };
  }
}

function parseElectrokinisiIdentifier(value: string) {
  const match = /^(GR)\s*([*-])\s*([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "GR",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}
