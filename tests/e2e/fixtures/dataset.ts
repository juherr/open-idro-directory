// The deterministic dataset the browser suite runs against, written as the
// `data/` files the D1 import bundle reads. Never the generated `data/`:
// the suite must not move when the scheduled update republishes it.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  makeRegistryKey,
  type NormalizedRegistryRecord,
  type RegistryRole,
  type RegistryStatus,
} from "../../../src/domain/registry-record.js";

const SEEN_AT = "2026-11-01T00:00:00.000Z";

/**
 * France has enough parties for a second explorer page (25 per page), Germany
 * shares a name with France (scoped search) and Cyprus has a register but no
 * record (empty country page).
 */
export const E2E_FIXTURE = {
  /** Parties named `Voltline NN` in France, more than one page of results. */
  voltlineCount: 28,
  /** A name searched on /countries/fr/ that a German party also carries. */
  sharedName: "Shared Mobility",
  /**
   * Two text queries of the stale-response scenario, one result each. Not
   * five letters long: `ALPHA` would be read as the identifier AL-PHA.
   */
  firstQuery: "Alpha Laden",
  secondQuery: "Beta Recharge",
};

interface PartyFixture {
  source: "fr-afirev" | "de-bdew";
  countryCode: "FR" | "DE";
  partyId: string;
  name: string;
  roles?: RegistryRole[];
  status?: RegistryStatus;
}

const voltlineParties: PartyFixture[] = Array.from(
  { length: E2E_FIXTURE.voltlineCount },
  (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      source: "fr-afirev",
      countryCode: "FR",
      partyId: `V${number}`,
      name: `Voltline ${number}`,
    };
  },
);

const parties: PartyFixture[] = [
  ...voltlineParties,
  {
    source: "fr-afirev",
    countryCode: "FR",
    partyId: "SHR",
    name: "Shared Mobility France",
    roles: ["CPO", "EMSP"],
  },
  {
    source: "fr-afirev",
    countryCode: "FR",
    partyId: "RVK",
    name: "Revoked Charge France",
    status: "REVOKED",
  },
  { source: "fr-afirev", countryCode: "FR", partyId: "BET", name: "Beta Recharge" },
  { source: "de-bdew", countryCode: "DE", partyId: "SHR", name: "Shared Mobility Germany" },
  { source: "de-bdew", countryCode: "DE", partyId: "ALP", name: "Alpha Laden" },
];

export function e2eRegistryRecords(): NormalizedRegistryRecord[] {
  return parties.flatMap((party) =>
    (party.roles ?? ["CPO"]).map((role) => ({
      key: makeRegistryKey(party.source, party.countryCode, party.partyId, role),
      countryCode: party.countryCode,
      partyId: party.partyId,
      eMobilityId: `${party.countryCode}${party.partyId}`,
      role,
      status: party.status ?? "ACTIVE",
      organization: { name: party.name, legalName: `${party.name} SAS`, website: null },
      source: {
        registryId: party.source,
        official: true,
        sourceRecordId: `${party.countryCode}${party.partyId}`,
        sourceUrl: `https://registry.example.org/${party.source}`,
        sourceValue: `${party.countryCode}*${party.partyId}`,
        firstSeenAt: SEEN_AT,
        lastSeenAt: SEEN_AT,
        retrievedAt: SEEN_AT,
      },
      metadata: {},
    })),
  );
}

function source(id: string, name: string, country: string, recordCount: number, enabled = true) {
  return {
    id,
    name,
    authority: {
      id,
      name,
      level: "AUTHORITATIVE",
      jurisdictions: [country],
      homepageUrl: `https://registry.example.org/${id}`,
    },
    registry: {
      url: `https://registry.example.org/${id}`,
      observationType: "OFFICIAL_ASSIGNMENT",
      supportedRoles: ["CPO", "EMSP"],
      jurisdictions: [country],
    },
    publication: {
      connector: id,
      machineReadableUrl: enabled ? `https://registry.example.org/${id}/data` : null,
      refreshSchedule: "weekly",
      enabled,
      verifiedAt: null,
    },
    official: true,
    reuse: {
      status: "unspecified",
      legalBasis: null,
      licence: null,
      attributionNotice: null,
      redistributionAllowed: null,
      notes: null,
    },
    health: {
      stale: false,
      recordCount,
      lastAttemptedRetrieval: enabled ? SEEN_AT : null,
      lastSuccessfulRetrieval: enabled ? SEEN_AT : null,
      checksum: null,
      freshness: enabled ? "current" : "disabled",
      latestErrorSummary: null,
    },
  };
}

/** Writes `registry.json`, `sources.json` and `stats.json` to `dataDir`. */
export async function writeE2eDataset(dataDir: string) {
  const records = e2eRegistryRecords();
  const count = (registryId: string) =>
    records.filter((record) => record.source.registryId === registryId).length;
  const sources = [
    source("fr-afirev", "AFIREV", "FR", count("fr-afirev")),
    source("de-bdew", "BDEW", "DE", count("de-bdew")),
    source("cy-ems", "Cyprus EMS", "CY", 0, false),
  ];
  const stats = { generatedAt: SEEN_AT, totalRecords: records.length };
  await mkdir(dataDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(dataDir, "registry.json"), `${JSON.stringify(records, null, 2)}\n`),
    writeFile(resolve(dataDir, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`),
    writeFile(resolve(dataDir, "stats.json"), `${JSON.stringify(stats, null, 2)}\n`),
  ]);
  return records;
}
