import type {
  FetchContext,
  FetchResult,
  NormalizeInput,
  NormalizeOutput,
  ParseInput,
  ParseOutput,
  RegistryConnector,
} from "../connector.js";
import { makeRegistryKey } from "../../domain/registry-record.js";
import { getText } from "../../infrastructure/http/http-client.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseLadestellenJson } from "./ladestellen.parser.js";
import type { LadestellenOperator } from "./ladestellen.types.js";

const PUBLIC_API_KEY = "cdb82459-5dd0-4aef-9632-88007e265517";
const SOURCE_HOSTS = ["admin.ladestellen.at", "api.e-control.at"];

export class LadestellenConnector implements RegistryConnector<LadestellenOperator> {
  readonly sourceId = "at-ladestellen";

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
        maxBytes: 5_000_000,
        allowedHosts: SOURCE_HOSTS,
        userAgent: context.userAgent,
        headers: {
          Apikey: PUBLIC_API_KEY,
          Referer: context.source.homepageUrl,
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

  async parse(input: ParseInput): Promise<ParseOutput<LadestellenOperator>> {
    return parseLadestellenJson(input.body);
  }

  async normalize(input: NormalizeInput<LadestellenOperator>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records = [];

    for (const sourceRecord of input.records) {
      const partyId = sourceRecord.operatorId.trim().toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(partyId)) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "LADESTELLEN_MALFORMED_IDENTIFIER",
          message: `Unexpected Ladestellen.at operator ID syntax: ${sourceRecord.operatorId}`,
        });
        continue;
      }
      const countryCode = "AT";
      records.push({
        key: makeRegistryKey(input.source.id, countryCode, partyId, "CPO"),
        countryCode,
        partyId,
        eMobilityId: `${countryCode}${partyId}`,
        role: "CPO" as const,
        status: "ACTIVE" as const,
        organization: {
          name: displayName(sourceRecord) || `Unspecified Ladestellen.at operator for ${partyId}`,
          legalName: clean(sourceRecord.organization),
          website: null,
        },
        source: {
          registryId: input.source.id,
          official: input.source.official,
          sourceRecordId: `${countryCode}${partyId}`,
          sourceUrl: input.source.homepageUrl,
          sourceValue: `${countryCode}*${partyId}`,
          firstSeenAt: input.retrievedAt,
          lastSeenAt: input.retrievedAt,
          retrievedAt: input.retrievedAt,
        },
        metadata: {
          ladestellenType: sourceRecord.type,
          organization: clean(sourceRecord.organization),
          firstName: clean(sourceRecord.firstName),
          lastName: clean(sourceRecord.lastName),
        },
      });
    }
    return { records, warnings, errors };
  }
}

function displayName(record: LadestellenOperator) {
  return (
    clean(record.organization) ||
    [record.firstName, record.lastName].map(clean).filter(Boolean).join(" ")
  );
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
