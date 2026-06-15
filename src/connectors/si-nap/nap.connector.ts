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
import { parseNapSnapshot } from "./nap.parser.js";
import type { NapRow } from "./nap.types.js";

const SOURCE_HOSTS = ["www.ncup.si"];

export class NapConnector implements RegistryConnector<NapRow> {
  readonly sourceId = "si-nap";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const response = await getBinary(context.source.registryUrl, {
      timeoutMs: 30_000,
      retries: 2,
      maxBytes: 2_000_000,
      allowedHosts: SOURCE_HOSTS,
      userAgent: context.userAgent,
      headers: {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        Referer: context.source.homepageUrl,
      },
    });
    const body = JSON.stringify({
      url: response.finalUrl,
      contentBase64: response.body.toString("base64"),
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

  async parse(input: ParseInput): Promise<ParseOutput<NapRow>> {
    try {
      return parseNapSnapshot(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "NAP_INVALID_SNAPSHOT",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<NapRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const identifiers = [
        ...(sourceRecord.cpoId ? [{ role: "CPO" as const, sourceValue: sourceRecord.cpoId }] : []),
        ...(sourceRecord.emspId
          ? [{ role: "EMSP" as const, sourceValue: sourceRecord.emspId }]
          : []),
      ];

      for (const identifier of identifiers) {
        const parsed = parseNapIdentifier(identifier.sourceValue);
        if (!parsed) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "NAP_MALFORMED_IDENTIFIER",
            message: `Unexpected Slovenian NAP identifier syntax: ${identifier.sourceValue}`,
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
            website: normalizeWebsite(sourceRecord.website),
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
            napAddress: sourceRecord.address,
            napCity: sourceRecord.city,
            napCountry: sourceRecord.country,
            napSeparator: parsed.separator,
          },
        });
      }
    }

    return { records, warnings, errors };
  }
}

function parseNapIdentifier(value: string) {
  const match = /^(SI)([*-])([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "SI",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
  };
}

function normalizeWebsite(value: string | null) {
  const cleaned = value?.trim();
  if (!cleaned) return null;
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}
