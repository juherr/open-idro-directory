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
import { parseBeneluxCsv } from "./benelux.parser.js";
import type { BeneluxCsvRow } from "./benelux.types.js";

const SOURCE_HOSTS = ["www.benelux-idro.eu"];

export class BeneluxIdroConnector implements RegistryConnector<BeneluxCsvRow> {
  readonly sourceId = "benelux-idro";

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
        maxBytes: 2_000_000,
        allowedHosts: SOURCE_HOSTS,
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

  async parse(input: ParseInput): Promise<ParseOutput<BeneluxCsvRow>> {
    try {
      return parseBeneluxCsv(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "BENELUX_INVALID_CSV",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<BeneluxCsvRow>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of input.records) {
      const organizationName =
        clean(sourceRecord.companyName) ?? "Unspecified Benelux IDRO organization";
      const website = normalizeWebsite(sourceRecord.website);
      const identifiers = [
        ...sourceRecord.cpoIds.map((sourceValue) => ({ role: "CPO" as const, sourceValue })),
        ...sourceRecord.emspIds.map((sourceValue) => ({ role: "EMSP" as const, sourceValue })),
      ];

      for (const identifier of identifiers) {
        const parsed = parseBeneluxIdentifier(identifier.sourceValue);
        if (!parsed) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "BENELUX_MALFORMED_IDENTIFIER",
            message: `Unexpected Benelux IDRO identifier syntax: ${identifier.sourceValue}`,
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
            code: "BENELUX_DUPLICATE_IDENTIFIER",
            message: `Duplicate Benelux IDRO identifier ${identifier.sourceValue} for ${identifier.role}.`,
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
            website,
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
            beneluxCompanyName: organizationName,
            beneluxWebsite: sourceRecord.website,
            beneluxSeparator: parsed.separator,
          },
        });
      }
    }
    return { records, warnings, errors };
  }
}

function parseBeneluxIdentifier(value: string) {
  const match = /^([A-Za-z]{2})([*-])([A-Za-z0-9]{3})$/.exec(value.trim());
  if (!match) return null;
  const countryCode = match[1] ?? "";
  const separator = match[2] ?? "";
  const partyId = match[3] ?? "";
  return {
    countryCode: countryCode.toUpperCase(),
    separator,
    partyId: partyId.toUpperCase(),
  };
}

function normalizeWebsite(value: string | null) {
  const cleaned = clean(value);
  if (!cleaned) return null;
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function clean(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}
