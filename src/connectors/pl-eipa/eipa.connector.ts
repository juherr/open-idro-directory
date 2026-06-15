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
import { parseEipaCsv } from "./eipa.parser.js";
import type { EipaCsvRow } from "./eipa.types.js";

const SOURCE_HOSTS = ["eipa.udt.gov.pl"];

export class EipaConnector implements RegistryConnector<EipaCsvRow> {
  readonly sourceId = "pl-eipa";

  async fetch(context: FetchContext): Promise<FetchResult> {
    const response = await getText(context.source.registryUrl, {
      timeoutMs: 30_000,
      retries: 2,
      maxBytes: 2_000_000,
      allowedHosts: SOURCE_HOSTS,
      userAgent: context.userAgent,
      headers: {
        Accept: "text/csv,text/plain,*/*",
        Referer: context.source.homepageUrl,
      },
    });
    return {
      status: "changed",
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

  async parse(input: ParseInput): Promise<ParseOutput<EipaCsvRow>> {
    try {
      return parseEipaCsv(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "EIPA_INVALID_CSV",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<EipaCsvRow>): Promise<NormalizeOutput> {
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
        const parsed = parseEipaIdentifier(identifier.sourceValue);
        if (!parsed) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "EIPA_MALFORMED_IDENTIFIER",
            message: `Unexpected EIPA identifier syntax: ${identifier.sourceValue}`,
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
            eipaCity: sourceRecord.city,
            eipaCountry: sourceRecord.country,
            eipaRegisteredAt: sourceRecord.registeredAt,
            eipaSeparator: parsed.separator,
          },
        });
      }
    }

    return { records, warnings, errors };
  }
}

function parseEipaIdentifier(value: string) {
  const match = /^(PL)([*-])([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "PL",
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
