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
import { parseHuIdroHtml } from "./hu-idro.parser.js";
import type { HuIdroHtmlRow } from "./hu-idro.types.js";

const SOURCE_HOSTS = ["idro.hu"];

export class HuIdroConnector implements RegistryConnector<HuIdroHtmlRow> {
  readonly sourceId = "hu-idro";

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

  async parse(input: ParseInput): Promise<ParseOutput<HuIdroHtmlRow>> {
    try {
      return parseHuIdroHtml(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "HU_IDRO_INVALID_HTML",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<HuIdroHtmlRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const parsed = parseHuIdroIdentifier(sourceRecord.sourceValue);
      if (!parsed) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "HU_IDRO_MALFORMED_IDENTIFIER",
          message: `Unexpected Hungarian IDRO identifier syntax: ${sourceRecord.sourceValue}`,
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
          code: "HU_IDRO_DUPLICATE_IDENTIFIER",
          message: `Duplicate Hungarian IDRO identifier ${sourceRecord.sourceValue} for ${sourceRecord.role}.`,
        });
        continue;
      }
      seen.add(key);

      records.push({
        key,
        countryCode: parsed.countryCode,
        partyId: parsed.partyId,
        eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
        role: sourceRecord.role,
        status: "ACTIVE" as const,
        organization: {
          name: sourceRecord.organizationName,
          legalName: sourceRecord.organizationName,
          website: null,
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
          huIdroCompanyName: sourceRecord.organizationName,
          huIdroTaxNumber: sourceRecord.taxNumber,
          huIdroSeparator: parsed.separator,
        },
      });
    }

    return { records, warnings, errors };
  }
}

function parseHuIdroIdentifier(value: string) {
  const match = /^(HU)\s*([*-])\s*([A-Za-z0-9]{3})\s*[*-]?$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "HU",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}
