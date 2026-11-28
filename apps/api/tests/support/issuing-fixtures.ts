import type { ObservationRow, PartyRoleRow, PartyRow } from "../../src/infrastructure/d1/types.js";
import { release } from "./country-fixtures.js";

/**
 * Parties of the issue #50 scenarios, with their roles and observations, as
 * the D1 import writes them after migration 0006 (and one row written before).
 */
export interface IssuingScenario {
  party: PartyRow;
  roles: PartyRoleRow[];
  observations: ObservationRow[];
}

const seenAt = "2026-11-16T05:00:00.000Z";

function partyRow(
  countryCode: string,
  partyId: string,
  name: string,
  overrides: Partial<PartyRow> = {},
): PartyRow {
  return {
    key: `${countryCode}:${partyId}`,
    country_code: countryCode,
    party_id: partyId,
    emobility_id: `${countryCode}${partyId}`,
    preferred_name: name,
    legal_name: name,
    website: null,
    consolidated_status: "ACTIVE",
    highest_authority_level: "AUTHORITATIVE",
    role_count: 1,
    observation_count: 2,
    has_conflict: 0,
    first_seen_at: seenAt,
    last_seen_at: seenAt,
    normalized_name: name.toLowerCase(),
    normalized_legal_name: name.toLowerCase(),
    dataset_release_id: release.id,
    ...overrides,
  };
}

function roleRow(
  party: PartyRow,
  confirmation: string | null,
  confirmedBy: string[] | null,
  overrides: Partial<PartyRoleRow> = {},
): PartyRoleRow {
  return {
    party_key: party.key,
    role: "CPO",
    consolidated_status: "ACTIVE",
    highest_authority_level: party.highest_authority_level,
    observation_count: party.observation_count,
    has_conflict: 0,
    issuing_confirmation: confirmation,
    issuing_confirmed_by_json: confirmedBy ? JSON.stringify(confirmedBy) : null,
    dataset_release_id: release.id,
    ...overrides,
  };
}

function assignment(party: PartyRow, sourceId: string, name: string): ObservationRow {
  return observationRow(party, sourceId, name, {
    authority_level: "AUTHORITATIVE",
    observation_type: "OFFICIAL_ASSIGNMENT",
    observation_kind: "ASSIGNMENT",
    observing_jurisdiction: party.country_code,
  });
}

function listing(
  party: PartyRow,
  sourceId: string,
  name: string,
  observingJurisdiction: string,
): ObservationRow {
  return observationRow(party, sourceId, name, {
    authority_level: "SECONDARY",
    observation_type: "OFFICIAL_DIRECTORY_ENTRY",
    observation_kind: "CROSS_REGISTER_LISTING",
    observing_jurisdiction: observingJurisdiction,
  });
}

function observationRow(
  party: PartyRow,
  sourceId: string,
  name: string,
  overrides: Partial<ObservationRow>,
): ObservationRow {
  return {
    key: `${sourceId}:${party.key}:CPO`,
    party_key: party.key,
    source_id: sourceId,
    scheme: "EMI3_OPERATOR_ID",
    country_code: party.country_code,
    party_id: party.party_id,
    emobility_id: party.emobility_id,
    role: "CPO",
    status: "ACTIVE",
    organization_name: name,
    legal_name: null,
    website: null,
    source_record_id: party.emobility_id,
    source_value: `${party.country_code}*${party.party_id}`,
    source_url: `https://${sourceId}.example/register`,
    authority_level: "AUTHORITATIVE",
    observation_type: "OFFICIAL_ASSIGNMENT",
    first_seen_at: seenAt,
    last_seen_at: seenAt,
    retrieved_at: seenAt,
    metadata_json: "{}",
    raw_record_checksum: null,
    observation_kind: null,
    observing_jurisdiction: null,
    dataset_release_id: release.id,
    ...overrides,
  };
}

const monta = partyRow("DK", "MON", "Monta ApS");
/** Issued in Denmark, also listed by the Swedish national dataset. */
export const dkMon: IssuingScenario = {
  party: monta,
  roles: [roleRow(monta, "CONFIRMED", ["dk-fstyr"])],
  observations: [
    assignment(monta, "dk-fstyr", "Monta ApS"),
    listing(monta, "se-energimyndigheten", "Monta AB", "SE"),
  ],
};

const shell = partyRow("NL", "TNM", "Shell Recharge");
/** Issued in the Netherlands, also listed by the Polish register. */
export const nlTnm: IssuingScenario = {
  party: shell,
  roles: [roleRow(shell, "CONFIRMED", ["benelux-idro"])],
  observations: [
    assignment(shell, "benelux-idro", "Shell Recharge"),
    listing(shell, "pl-eipa", "Shell Recharge Polska", "PL"),
  ],
};

const norwegian = partyRow("NO", "XYZ", "Nordic Charge", {
  highest_authority_level: "SECONDARY",
  observation_count: 1,
});
/** Only listed outside its country, which no issuing register covers. */
export const noXyz: IssuingScenario = {
  party: norwegian,
  roles: [roleRow(norwegian, "NO_ISSUING_SOURCE", [])],
  observations: [listing(norwegian, "se-energimyndigheten", "Nordic Charge", "SE")],
};

const legacy = partyRow("FR", "OLD", "Legacy Mobility", { observation_count: 1 });
/** Imported before migration 0006: the new columns are NULL. */
export const frOld: IssuingScenario = {
  party: legacy,
  roles: [roleRow(legacy, null, null)],
  observations: [
    observationRow(legacy, "fr-afirev", "Legacy Mobility", {
      observation_kind: null,
      observing_jurisdiction: null,
    }),
  ],
};

export const issuingScenarios = [dkMon, nlTnm, noXyz, frOld];

/** A D1 double answering the party, role and observation reads of the scenarios. */
export function issuingD1(scenarios: IssuingScenario[] = issuingScenarios): D1Database {
  const byKey = new Map(scenarios.map((scenario) => [scenario.party.key, scenario]));
  const run = (sql: string, params: unknown[]) => ({
    first: async <T>() => {
      if (sql.includes("FROM active_dataset")) return release as T;
      if (sql.includes("FROM parties") && sql.includes("country_code = ?")) {
        const [, countryCode, partyId] = params;
        return (byKey.get(`${String(countryCode)}:${String(partyId)}`)?.party ?? null) as T;
      }
      return null;
    },
    all: async <T>() => {
      const scenario = byKey.get(String(params[1]));
      if (sql.includes("FROM party_roles")) return { results: (scenario?.roles ?? []) as T[] };
      if (sql.includes("FROM observations"))
        return { results: (scenario?.observations ?? []) as T[] };
      return { results: [] as T[] };
    },
  });
  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => run(sql, params),
      ...run(sql, []),
    }),
  } as unknown as D1Database;
}
