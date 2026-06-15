import { describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/http/app.js";
import worker from "../src/index.js";
import type {
  ConflictRow,
  DatasetRelease,
  ObservationRow,
  PartyRoleRow,
  PartyRow,
  SourceRow,
} from "../src/infrastructure/d1/types.js";

const release: DatasetRelease = {
  id: "release-1",
  git_commit_sha: "abc123",
  git_ref: "main",
  generated_at: "2026-06-15T06:39:47.501Z",
  imported_at: "1970-01-01T00:00:00.000Z",
  dataset_checksum: "checksum-1",
  schema_version: "1.0.0",
  record_count: 1,
  source_count: 1,
  importer_version: "0.1.0",
};

const party: PartyRow = {
  key: "FR:ABC",
  country_code: "FR",
  party_id: "ABC",
  emobility_id: "FRABC",
  preferred_name: "Example Mobility",
  legal_name: "Example Legal Group",
  website: "https://example.com",
  consolidated_status: "ACTIVE",
  highest_authority_level: "AUTHORITATIVE",
  role_count: 1,
  observation_count: 1,
  has_conflict: 0,
  first_seen_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: "2026-01-01T00:00:00.000Z",
  normalized_name: "example mobility",
  normalized_legal_name: "example legal group",
  dataset_release_id: release.id,
};

const role: PartyRoleRow = {
  party_key: party.key,
  role: "CPO",
  consolidated_status: "ACTIVE",
  highest_authority_level: "AUTHORITATIVE",
  observation_count: 1,
  has_conflict: 0,
  dataset_release_id: release.id,
};

const source: SourceRow = {
  id: "fr-afirev",
  name: "AFIREV",
  authority_name: "AFIREV",
  authority_level: "AUTHORITATIVE",
  observation_type: "OFFICIAL_ASSIGNMENT",
  official: 1,
  homepage_url: "https://afirev.fr/",
  registry_url: "https://api.afirev.fr/public/prefixes",
  jurisdictions_json: '["FR"]',
  license_status: "unknown",
  license_name: null,
  license_url: null,
  health_status: "current",
  record_count: 1,
  last_attempted_at: "2026-01-01T00:00:00.000Z",
  last_successful_at: "2026-01-01T00:00:00.000Z",
  last_changed_at: null,
  freshness_status: "current",
  latest_error_summary: null,
  source_checksum: "source-checksum",
  dataset_release_id: release.id,
};

const observation: ObservationRow = {
  key: "fr-afirev:FR:ABC:CPO",
  party_key: party.key,
  source_id: source.id,
  scheme: "EMI3_OPERATOR_ID",
  country_code: "FR",
  party_id: "ABC",
  emobility_id: "FRABC",
  role: "CPO",
  status: "ACTIVE",
  organization_name: "Example Mobility",
  legal_name: null,
  website: "https://example.com",
  source_record_id: "ABC",
  source_value: "FRABC",
  source_url: "https://api.afirev.fr/public/prefixes",
  authority_level: "AUTHORITATIVE",
  observation_type: "OFFICIAL_ASSIGNMENT",
  first_seen_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: "2026-01-01T00:00:00.000Z",
  retrieved_at: "2026-01-01T00:00:00.000Z",
  metadata_json: "{}",
  raw_record_checksum: null,
  dataset_release_id: release.id,
};

const conflict: ConflictRow = {
  key: "conflict-1",
  party_key: party.key,
  role: "CPO",
  conflict_type: "IDENTIFIER_HOLDER_MISMATCH",
  severity: "HIGH",
  summary: "Observed holder differs from official holder.",
  details_json: "{}",
  source_ids_json: '["fr-afirev"]',
  detected_at: "2026-01-01T00:00:00.000Z",
  dataset_release_id: release.id,
};

describe("Cloudflare API", () => {
  it("serves the root response with disclaimer and ETag", async () => {
    const response = await request("/api/v1");
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toMatch(/^"/);
    expect(response.headers.get("x-dataset-release")).toBe(release.id);
    const body = (await response.json()) as { data: { disclaimer: string } };
    expect(body.data.disclaimer).toContain("does not issue e-mobility identifiers");
  });

  it("returns 304 when the ETag matches", async () => {
    const first = await request("/api/v1/dataset");
    const second = await request("/api/v1/dataset", {
      headers: { "If-None-Match": first.headers.get("etag") ?? "" },
    });
    expect(second.status).toBe(304);
  });

  it("lists and resolves parties", async () => {
    const list = await request("/api/v1/parties?country=fr&limit=1");
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { data: { items: Array<{ eMobilityId: string }> } };
    expect(listBody.data.items[0]?.eMobilityId).toBe("FRABC");

    const legalNameSearch = await request("/api/v1/parties?q=legal%20group&limit=1");
    expect(legalNameSearch.status).toBe(200);
    const legalNameSearchBody = (await legalNameSearch.json()) as {
      data: { items: Array<{ eMobilityId: string }> };
    };
    expect(legalNameSearchBody.data.items[0]?.eMobilityId).toBe("FRABC");

    const resolved = await request("/api/v1/resolve/FRABC");
    const resolvedBody = (await resolved.json()) as { data: { party: { partyId: string } } };
    expect(resolvedBody.data.party.partyId).toBe("ABC");
  });

  it("rejects unsupported identifier formats", async () => {
    const response = await request("/api/v1/resolve/FRABC123456");
    expect(response.status).toBe(422);
  });

  it("rejects unknown query filters", async () => {
    const response = await request("/api/v1/parties?unknown=1");
    expect(response.status).toBe(400);
  });

  it("exposes source health, observations, conflicts, stats and OpenAPI", async () => {
    expect((await request("/api/v1/sources/fr-afirev/health")).status).toBe(200);
    expect((await request("/api/v1/parties/FR/ABC/observations")).status).toBe(200);
    expect((await request("/api/v1/parties/FR/ABC/conflicts")).status).toBe(200);
    const stats = await request("/api/v1/stats");
    expect(stats.status).toBe(200);
    const statsBody = (await stats.json()) as {
      data: {
        countsByCountry: Record<string, number>;
        countsByIdentifierCountry: Record<string, number>;
        countsByPartyCountry: Record<string, number>;
      };
    };
    expect(statsBody.data.countsByCountry.FR).toBe(2);
    expect(statsBody.data.countsByIdentifierCountry.FR).toBe(2);
    expect(statsBody.data.countsByPartyCountry.FR).toBe(1);
    expect((await request("/openapi.json")).status).toBe(200);
  });

  it("routes web pages to static assets without intercepting the API", async () => {
    const root = await workerRequest("/");
    expect(root.status).toBe(200);
    expect(root.headers.get("content-type")).toContain("text/html");
    await expect(root.text()).resolves.toContain("Open IDRO Directory");

    const explore = await workerRequest("/explore/");
    expect(explore.status).toBe(200);
    await expect(explore.text()).resolves.toContain("Explorateur de données");

    const stats = await workerRequest("/api/v1/stats");
    expect(stats.status).toBe(200);
    const statsBody = (await stats.json()) as {
      data: { totalParties: number; countsByIdentifierCountry: Record<string, number> };
    };
    expect(statsBody.data.totalParties).toBe(1);
    expect(statsBody.data.countsByIdentifierCountry.FR).toBe(2);
  });

  it("returns the asset-layer 404 for unknown non-API routes", async () => {
    const response = await workerRequest("/does-not-exist");
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Asset not found.");
  });
});

function request(path: string, init?: RequestInit) {
  const app = createApp();
  return app.request(path, init, { REGISTRY_DB: fakeD1() } satisfies Env);
}

function workerRequest(path: string, init?: RequestInit) {
  return worker.fetch(
    new Request(`https://example.test${path}`, init) as Parameters<
      NonNullable<typeof worker.fetch>
    >[0],
    { REGISTRY_DB: fakeD1(), ASSETS: fakeAssets() },
    {} as ExecutionContext,
  );
}

function fakeAssets(): Fetcher {
  return {
    fetch: async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/" || path === "/index.html") {
        return new Response("<!doctype html><title>Open IDRO Directory</title>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (path === "/explore" || path === "/explore/" || path === "/explore/index.html") {
        return new Response("<!doctype html><title>Explorateur de données</title>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Asset not found.", { status: 404 });
    },
  } as Fetcher;
}

function fakeD1(): D1Database {
  return {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => statement(sql, params),
      first: async <T>() => first<T>(sql, []),
      all: async <T>() => ({ results: all<T>(sql, []) }),
    }),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function statement(sql: string, params: unknown[]) {
  return {
    first: async <T>() => first<T>(sql, params),
    all: async <T>() => ({ results: all<T>(sql, params) }),
  };
}

function first<T>(sql: string, params: unknown[]): T | null {
  if (sql.includes("FROM active_dataset")) return release as T;
  if (sql.includes("FROM parties") && sql.includes("country_code = ?") && params.includes("ABC"))
    return party as T;
  if (sql.includes("FROM sources") && sql.includes("id = ?")) return source as T;
  if (sql.includes("SELECT") && sql.includes("AS parties")) {
    return { parties: 1, observations: 2, conflicts: 1 } as T;
  }
  return null;
}

function all<T>(sql: string, params: unknown[]): T[] {
  if (sql.includes("FROM parties p")) {
    if (params.some((param) => String(param).includes("legal group"))) {
      return sql.includes("p.normalized_legal_name") ? ([party] as T[]) : [];
    }
    return [party] as T[];
  }
  if (sql.includes("FROM party_roles")) return [role] as T[];
  if (sql.includes("FROM observations") && sql.includes("GROUP BY country_code"))
    return [{ key: "FR", count: 2 }] as T[];
  if (sql.includes("FROM observations")) return [observation] as T[];
  if (sql.includes("FROM conflicts")) return [conflict] as T[];
  if (sql.includes("FROM sources") && !sql.includes("id = ?")) return [source] as T[];
  if (sql.includes("GROUP BY country_code")) return [{ key: "FR", count: 1 }] as T[];
  if (sql.includes("GROUP BY role")) return [{ key: "CPO", count: 1 }] as T[];
  if (sql.includes("GROUP BY consolidated_status")) return [{ key: "ACTIVE", count: 1 }] as T[];
  if (sql.includes("GROUP BY highest_authority_level"))
    return [{ key: "AUTHORITATIVE", count: 1 }] as T[];
  if (sql.includes("record_count AS count")) return [{ key: "fr-afirev", count: 1 }] as T[];
  if (sql.includes("GROUP BY severity")) return [{ key: "HIGH", count: 1 }] as T[];
  return [];
}
