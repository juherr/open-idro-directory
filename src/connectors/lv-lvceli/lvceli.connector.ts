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
import { parseLvceliJson } from "./lvceli.parser.js";
import type { LvceliRow } from "./lvceli.types.js";

const SOURCE_HOSTS = ["www.transportdata.gov.lv"];

export class LvceliConnector implements RegistryConnector<LvceliRow> {
  readonly sourceId = "lv-lvceli";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const response = await getText(context.source.registryUrl, {
      timeoutMs: 30_000,
      retries: 2,
      maxBytes: 2_000_000,
      allowedHosts: SOURCE_HOSTS,
      userAgent: context.userAgent,
      headers: {
        Accept: "application/json,*/*",
      },
    });
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

  async parse(input: ParseInput): Promise<ParseOutput<LvceliRow>> {
    try {
      return parseLvceliJson(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "LVCELI_INVALID_JSON",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<LvceliRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const identifiers = [
        ...sourceRecord.cpoIds.map((sourceValue) => ({ role: "CPO" as const, sourceValue })),
        ...sourceRecord.emspIds.map((sourceValue) => ({ role: "EMSP" as const, sourceValue })),
      ];

      for (const identifier of identifiers) {
        const parsed = parseLatvianIdentifier(identifier.sourceValue);
        if (!parsed) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "LVCELI_MALFORMED_IDENTIFIER",
            message: `Unexpected Latvian IDRO identifier syntax: ${identifier.sourceValue}`,
          });
          continue;
        }
        const key = makeRegistryKey(
          input.source.id,
          parsed.countryCode,
          parsed.partyId,
          identifier.role,
        );
        if (seen.has(key)) continue;
        seen.add(key);

        records.push({
          key,
          countryCode: parsed.countryCode,
          partyId: parsed.partyId,
          eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
          role: identifier.role satisfies RegistryRole,
          status: "ACTIVE" as const,
          organization: {
            name: sourceRecord.legalEntityName,
            legalName: sourceRecord.legalEntityName,
            website: sourceRecord.website,
          },
          source: {
            registryId: input.source.id,
            official: input.source.official,
            sourceRecordId: `${parsed.countryCode}${parsed.partyId}`,
            sourceUrl: input.source.homepageUrl,
            sourceValue: identifier.sourceValue,
            firstSeenAt: input.retrievedAt,
            lastSeenAt: input.retrievedAt,
            retrievedAt: input.retrievedAt,
          },
          metadata: {
            lvceliLegalEntityName: sourceRecord.legalEntityName,
            lvceliEmail: sourceRecord.email,
            lvceliSeparator: parsed.separator,
          },
        });
      }
    }

    return { records, warnings, errors };
  }
}

function parseLatvianIdentifier(value: string) {
  const match = /^(LV)\s*([*-]?)\s*([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "LV",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}
