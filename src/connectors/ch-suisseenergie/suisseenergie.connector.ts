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
import { parseSuisseEnergieJson } from "./suisseenergie.parser.js";
import type { SuisseEnergieProvider } from "./suisseenergie.types.js";

const SOURCE_HOSTS = ["www.suisseenergie.ch"];
const LOCALE_PRIORITY = ["fr", "de", "it"];

export class SuisseEnergieConnector implements RegistryConnector<SuisseEnergieProvider> {
  readonly sourceId = "ch-suisseenergie";

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
        headers: {
          Accept: "application/json,*/*",
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

  async parse(input: ParseInput): Promise<ParseOutput<SuisseEnergieProvider>> {
    try {
      return parseSuisseEnergieJson(input.body);
    } catch (error) {
      return {
        records: [],
        warnings: [],
        errors: [
          {
            severity: "error",
            code: "SUISSEENERGIE_INVALID_JSON",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  async normalize(input: NormalizeInput<SuisseEnergieProvider>): Promise<NormalizeOutput> {
    const warnings: ValidationIssue[] = [];
    const errors: ValidationIssue[] = [];
    const records: NormalizedRegistryRecord[] = [];
    const seen = new Set<string>();

    for (const sourceRecord of preferredLocaleRecords(input.records)) {
      const parsed = parseSuisseEnergieIdentifier(sourceRecord.digitId);
      if (!parsed) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "SUISSEENERGIE_MALFORMED_IDENTIFIER",
          message: `Unexpected SuisseEnergie identifier syntax: ${sourceRecord.digitId}`,
        });
        continue;
      }

      const roles = rolesFor(sourceRecord);
      if (roles.length === 0) {
        warnings.push({
          severity: "warning",
          sourceId: input.source.id,
          code: "SUISSEENERGIE_IDENTIFIER_WITHOUT_ROLE",
          message: `SuisseEnergie identifier ${sourceRecord.digitId} has no CPO or EMP role.`,
        });
        continue;
      }

      const organizationName =
        clean(sourceRecord.organization.companyName) ?? "Unspecified SuisseEnergie organization";
      const website = normalizeWebsite(sourceRecord.organization.website);
      for (const role of roles) {
        const key = makeRegistryKey(input.source.id, parsed.countryCode, parsed.partyId, role);
        if (seen.has(key)) {
          warnings.push({
            severity: "warning",
            sourceId: input.source.id,
            code: "SUISSEENERGIE_DUPLICATE_IDENTIFIER",
            message: `Duplicate SuisseEnergie identifier ${sourceRecord.digitId} for ${role}.`,
          });
          continue;
        }
        seen.add(key);

        records.push({
          key,
          countryCode: parsed.countryCode,
          partyId: parsed.partyId,
          eMobilityId: `${parsed.countryCode}${parsed.partyId}`,
          role,
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
            sourceValue: sourceRecord.digitId,
            firstSeenAt: input.retrievedAt,
            lastSeenAt: input.retrievedAt,
            retrievedAt: input.retrievedAt,
          },
          metadata: {
            suisseEnergieCompanyName: organizationName,
            suisseEnergieLocale: sourceRecord.node_locale,
            suisseEnergieWebsite: sourceRecord.organization.website,
            suisseEnergieSeparator: parsed.separator,
            suisseEnergieCpo: sourceRecord.CPO,
            suisseEnergieEmp: sourceRecord.EMP,
          },
        });
      }
    }

    return { records, warnings, errors };
  }
}

function preferredLocaleRecords(records: SuisseEnergieProvider[]) {
  const byIdentifier = new Map<string, SuisseEnergieProvider[]>();
  for (const record of records) {
    const key = record.digitId.trim().toUpperCase();
    byIdentifier.set(key, [...(byIdentifier.get(key) ?? []), record]);
  }

  return [...byIdentifier.values()].flatMap((records) => {
    const preferred = records.toSorted(
      (left, right) => localeRank(left.node_locale) - localeRank(right.node_locale),
    )[0];
    return preferred ? [preferred] : [];
  });
}

function localeRank(locale: string) {
  const rank = LOCALE_PRIORITY.indexOf(locale);
  return rank === -1 ? LOCALE_PRIORITY.length : rank;
}

function rolesFor(record: SuisseEnergieProvider): RegistryRole[] {
  return [...(record.CPO ? (["CPO"] as const) : []), ...(record.EMP ? (["EMSP"] as const) : [])];
}

function parseSuisseEnergieIdentifier(value: string) {
  const match = /^(CH)\s*([*-]?)\s*([A-Za-z0-9]{3})$/i.exec(value.trim());
  if (!match) return null;
  return {
    countryCode: "CH",
    separator: match[2] ?? "",
    partyId: (match[3] ?? "").toUpperCase(),
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
