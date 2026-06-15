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
import { getBinary, sha256 } from "../../infrastructure/http/http-client.js";
import type { ValidationIssue } from "../../domain/validation-issue.js";
import { parseMobieSnapshot } from "./mobie.parser.js";
import type { MobieRow } from "./mobie.types.js";

const SOURCE_HOSTS = ["www.mobie.pt"];

export class MobieConnector implements RegistryConnector<MobieRow> {
  readonly sourceId = "pt-mobie";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const response = await getBinary(context.source.registryUrl, {
      timeoutMs: 30_000,
      retries: 2,
      maxBytes: 2_000_000,
      allowedHosts: SOURCE_HOSTS,
      userAgent: context.userAgent,
      headers: {
        Accept: "application/pdf,*/*",
        Referer: context.source.homepageUrl,
      },
    });
    const body = JSON.stringify({
      url: response.finalUrl,
      pdfBase64: response.body.toString("base64"),
    });
    return {
      status: "changed",
      sourceId: this.sourceId,
      body,
      contentType: "application/json",
      finalUrl: response.finalUrl,
      httpStatus: response.status,
      retrievedAt: context.retrievedAt,
      checksum: sha256(body),
      etag: response.etag,
      lastModified: response.lastModified,
    };
  }

  async parse(input: ParseInput): Promise<ParseOutput<MobieRow>> {
    try {
      return await parseMobieSnapshot(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "MOBIE_INVALID_SNAPSHOT",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<MobieRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const identifiers = [
        ...(sourceRecord.isCpo
          ? [{ role: "CPO" as const, sourceValue: `PT${sourceRecord.partyId}` }]
          : []),
        ...(sourceRecord.isEmsp
          ? [{ role: "EMSP" as const, sourceValue: `PT${sourceRecord.partyId}` }]
          : []),
      ];

      for (const identifier of identifiers) {
        const parsed = parseMobieIdentifier(identifier.sourceValue);
        if (!parsed) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "MOBIE_MALFORMED_IDENTIFIER",
            message: `Unexpected MOBI.E identifier syntax: ${identifier.sourceValue}`,
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
            name: sourceRecord.organizationName,
            legalName: sourceRecord.organizationName,
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
            mobieCode: sourceRecord.code,
            mobiePartyId: sourceRecord.partyId,
          },
        });
      }
    }

    return { records, warnings, errors };
  }
}

function parseMobieIdentifier(value: string) {
  const match = /^(PT)([A-Z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return { countryCode: "PT", partyId: (match[2] ?? "").toUpperCase() };
}
