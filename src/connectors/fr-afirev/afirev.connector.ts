import type {
  FetchContext,
  FetchResult,
  NormalizeInput,
  NormalizeOutput,
  ParseInput,
  ParseOutput,
  RegistryConnector,
} from "../connector.js";
import { getText } from "../../infrastructure/http/http-client.js";
import {
  makeRegistryKey,
  type RegistryRole,
  type RegistryStatus,
} from "../../domain/registry-record.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseAfirevJson } from "./afirev.parser.js";
import type { AfirevRecord } from "./afirev.types.js";

const TYPE_TO_ROLES: Record<string, RegistryRole[]> = {
  CHARGE: ["CPO"],
  MOBILITY: ["EMSP"],
  BOTH: ["CPO", "EMSP"],
};

const STATUS_MAP: Record<string, RegistryStatus> = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  RESERVED: "RESERVED",
  AWAITING_PAYMENT: "RESERVED",
  SUSPENDED: "UNKNOWN",
  UNKNOWN: "UNKNOWN",
};

export class AfirevConnector implements RegistryConnector<AfirevRecord> {
  readonly sourceId = "fr-afirev";

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
        allowedHosts: ["api.afirev.fr"],
        userAgent: context.userAgent,
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

  async parse(input: ParseInput): Promise<ParseOutput<AfirevRecord>> {
    return parseAfirevJson(input.body);
  }

  async normalize(input: NormalizeInput<AfirevRecord>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records = [];

    for (const sourceRecord of input.records) {
      const prefix = sourceRecord.prefixId.trim();
      if (!/^[A-Za-z]{2}[A-Za-z0-9]{3}$/.test(prefix)) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "AFIREV_MALFORMED_IDENTIFIER",
          message: `Unexpected AFIREV prefix syntax: ${prefix}`,
        });
        continue;
      }
      const countryCode = prefix.slice(0, 2).toUpperCase();
      const partyId = prefix.slice(2).toUpperCase();
      const roles = TYPE_TO_ROLES[sourceRecord.type] ?? ["OTHER"];
      if (!TYPE_TO_ROLES[sourceRecord.type]) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "AFIREV_UNKNOWN_ROLE",
          message: `Unknown AFIREV type ${sourceRecord.type} for ${prefix}`,
        });
      }
      const status = STATUS_MAP[sourceRecord.status] ?? "UNKNOWN";
      if (!STATUS_MAP[sourceRecord.status]) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "AFIREV_UNKNOWN_STATUS",
          message: `Unknown AFIREV status ${sourceRecord.status} for ${prefix}`,
        });
      }
      const name = clean(sourceRecord.name) || `Unspecified AFIREV organization for ${prefix}`;
      for (const role of roles) {
        records.push({
          key: makeRegistryKey(input.source.id, countryCode, partyId, role),
          countryCode,
          partyId,
          eMobilityId: `${countryCode}${partyId}`,
          role,
          status,
          organization: {
            name,
            legalName:
              clean(sourceRecord.exploitantName) || clean(sourceRecord.amenageurName) || null,
            website: null,
          },
          source: {
            registryId: input.source.id,
            official: input.source.official,
            sourceRecordId: prefix,
            sourceUrl: input.source.homepageUrl,
            sourceValue: sourceRecord.prefixId,
            firstSeenAt: input.retrievedAt,
            lastSeenAt: input.retrievedAt,
            retrievedAt: input.retrievedAt,
          },
          metadata: {
            afirevType: sourceRecord.type,
            afirevStatus: sourceRecord.status,
            amenageurName: clean(sourceRecord.amenageurName),
            exploitantName: clean(sourceRecord.exploitantName),
          },
        });
      }
    }
    return { records, warnings, errors };
  }
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
