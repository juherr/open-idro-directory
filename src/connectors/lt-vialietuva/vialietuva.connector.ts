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
import { parseVialietuvaLocations } from "./vialietuva.parser.js";
import type { VialietuvaLocation } from "./vialietuva.types.js";

const SOURCE_HOSTS = ["ev.vialietuva.lt"];

export class VialietuvaConnector implements RegistryConnector<VialietuvaLocation> {
  readonly sourceId = "lt-vialietuva";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const response = await getText(context.source.registryUrl, {
      timeoutMs: 30_000,
      retries: 2,
      maxBytes: 5_000_000,
      allowedHosts: SOURCE_HOSTS,
      userAgent: context.userAgent,
      headers: {
        Accept: "application/json,*/*",
        Referer: context.source.homepageUrl,
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

  async parse(input: ParseInput): Promise<ParseOutput<VialietuvaLocation>> {
    try {
      return parseVialietuvaLocations(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "VIALIETUVA_INVALID_JSON",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<VialietuvaLocation>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const byKey = new Map<
      string,
      NormalizedRegistryRecord & {
        metadata: Record<string, string | number | boolean | null>;
      }
    >();

    for (const sourceRecord of input.records) {
      const parsed = parseLithuanianIdentifier(sourceRecord.country_code, sourceRecord.party_id);
      if (!parsed) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "VIALIETUVA_MALFORMED_IDENTIFIER",
          message: `Unexpected Via Lietuva identifier syntax: ${sourceRecord.country_code}-${sourceRecord.party_id}`,
        });
        continue;
      }

      const key = makeRegistryKey(input.source.id, parsed.countryCode, parsed.partyId, "CPO");
      const existing = byKey.get(key);
      if (existing) {
        existing.metadata.vialietuvaLocationCount =
          Number(existing.metadata.vialietuvaLocationCount ?? 1) + 1;
        continue;
      }

      const organizationName =
        sourceRecord.operator?.name ??
        sourceRecord.owner?.name ??
        "Unspecified Via Lietuva operator";
      byKey.set(key, {
        key,
        countryCode: parsed.countryCode,
        partyId: parsed.partyId,
        eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
        role: "CPO" as const,
        status: "ACTIVE" as const,
        organization: {
          name: organizationName,
          legalName: organizationName,
          website: normalizeWebsite(sourceRecord.operator?.website ?? sourceRecord.owner?.website),
        },
        source: {
          registryId: input.source.id,
          official: input.source.official,
          sourceRecordId: `${parsed.countryCode}${parsed.partyId}`,
          sourceUrl: input.source.homepageUrl,
          sourceValue: `${sourceRecord.country_code}-${sourceRecord.party_id}`,
          firstSeenAt: input.retrievedAt,
          lastSeenAt: input.retrievedAt,
          retrievedAt: input.retrievedAt,
        },
        metadata: {
          vialietuvaLocationCount: 1,
          vialietuvaOperatorName: sourceRecord.operator?.name ?? null,
          vialietuvaOwnerName: sourceRecord.owner?.name ?? null,
        },
      });
    }

    records.push(...byKey.values());
    return { records, warnings, errors };
  }
}

function parseLithuanianIdentifier(countryCode: string, partyId: string) {
  if (!/^LT$/i.test(countryCode) || !/^[A-Za-z0-9]{3}$/.test(partyId)) return null;
  return { countryCode: "LT", partyId: partyId.toUpperCase() };
}

function normalizeWebsite(value: string | undefined) {
  const cleaned = value?.trim();
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return `https://${cleaned}`;
}
