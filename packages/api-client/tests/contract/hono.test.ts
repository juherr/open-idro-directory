import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "../../../../apps/api/src/domain/constants.js";
import { createApp, type Env } from "../../../../apps/api/src/http/app.js";
import { fakeD1, release } from "../../../../apps/api/tests/support/api-fixtures.js";
import {
  ApiError,
  createApiClient,
  createDirectoryApi,
  type ApiFetcher,
  type ApiResult,
  type PartyListQuery,
} from "../../src/index.js";

// The real Hono app in process, on the API suite's D1 fake: one French party, FR*ABC.
const app = createApp();
const env: Env = { REGISTRY_DB: fakeD1() };
const fetcher: ApiFetcher = async (input, init) => app.request(input, init, env);
const api = createDirectoryApi(createApiClient({ fetch: fetcher, baseUrl: "http://api.internal" }));

const EXPECTED_META = {
  datasetReleaseId: release.id,
  generatedAt: release.generated_at,
  schemaVersion: release.schema_version,
};

/** Asserts a fresh answer with the API's metadata, and returns its data. */
function fresh<T>(result: ApiResult<T>): T {
  if (result.notModified) throw new Error("Expected a fresh answer, got 304.");
  expect(result.meta).toEqual(EXPECTED_META);
  expect(result.headers).toMatchObject({
    datasetRelease: release.id,
    schemaVersion: SCHEMA_VERSION,
    cacheControl: expect.stringContaining("max-age"),
  });
  expect(result.headers.etag).toMatch(/^(W\/)?".+"$/);
  expect(result.headers.requestId).toMatch(/^[0-9a-f-]{36}$/);
  return result.data;
}

describe("api client against the Hono app", () => {
  it("reads the index", async () => {
    const data = fresh(await api.index());
    expect(data.version).toBe("v1");
    expect(data.dataset.releaseId).toBe(release.id);
    expect(data.links.countries).toBe("/api/v1/countries/{countryCode}");
  });

  it("reads the stats", async () => {
    const data = fresh(await api.stats());
    expect(data.totalParties).toBeTypeOf("number");
    expect(data.countsByIdentifierCountry).toEqual({ FR: 2 });
    expect(data.datasetTimestamp).toBe(release.generated_at);
  });

  it("reads the sources", async () => {
    const data = fresh(await api.sources());
    expect(data.items.map((source) => source.id)).toEqual(["fr-afirev"]);
    expect(data.items[0]?.authority.name).toBe("AFIREV");
    expect(data.items[0]?.registry.supportedRoles).toEqual(["CPO", "EMSP"]);
    expect(data.items[0]?.reuse.licence).toEqual({
      name: "CC BY 4.0",
      url: "https://creativecommons.org/licenses/by/4.0/",
    });
  });

  it("reads a country summary", async () => {
    const data = fresh(await api.country("fr"));
    expect(data.countryCode).toBe("FR");
    expect(data.authorities.map((authority) => authority.sourceIds)).toEqual([["fr-afirev"]]);
    expect(data.sources[0]?.countryObservations.total).toBe(2);
    expect(data.coverage.status).toBe("PUBLISHED");
    expect(data.statistics.parties).toBe(1);
    expect(data.links.parties).toBe("/api/v1/parties?country=FR");
  });

  it("lists parties with the site's filters and the cursor shape", async () => {
    const data = fresh(
      await api.parties({ country: "FR", role: "CPO", status: "ACTIVE", q: "example", limit: 25 }),
    );
    expect(data.items.map((party) => party.eMobilityId)).toEqual(["FRABC"]);
    expect(data.items[0]?.roles).toEqual([]);
    expect(data.pagination).toEqual({ nextCursor: null });
  });

  it("lists parties by e-mobility identifier", async () => {
    const data = fresh(await api.parties({ emobilityId: "FR*ABC", limit: 25 }));
    expect(data.items.map((party) => party.partyId)).toEqual(["ABC"]);
  });

  // The D1 fake answers any party query: only the API's validation proves each filter is sent.
  it.each<[string, PartyListQuery, number]>([
    ["country", { country: "FRA" }, 400],
    ["role", { role: "DRIVER" as PartyListQuery["role"] }, 400],
    ["status", { status: "GONE" as PartyListQuery["status"] }, 400],
    ["q", { q: "x" }, 400],
    ["emobilityId", { emobilityId: "x" }, 400],
    ["limit", { limit: 500 }, 400],
    // parseQuery answers 422 instead of 400 once a cursor is present.
    ["cursor", { cursor: "c".repeat(501) }, 422],
  ])("sends the %s filter to the API's validation", async (_name, query, status) => {
    const error: unknown = await api.parties(query).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "http", status, envelope: { code: "INVALID_QUERY" } });
  });

  it("reads a party with its roles' issuing confirmation", async () => {
    const data = fresh(await api.party("FR", "ABC"));
    expect(data.preferredName).toBe("Example Mobility");
    expect(data.roles).toEqual([
      expect.objectContaining({
        role: "CPO",
        issuing: { confirmation: "CONFIRMED", confirmedBy: ["fr-afirev"] },
      }),
    ]);
    expect(data.sourceSummary).toEqual([{ id: "fr-afirev", url: "/api/v1/sources/fr-afirev" }]);
    expect(data.links.observations).toBe("/api/v1/parties/FR/ABC/observations");
  });

  it("lists a party's observations", async () => {
    const data = fresh(await api.partyObservations("FR", "ABC"));
    expect(data.items[0]).toMatchObject({
      sourceId: "fr-afirev",
      role: "CPO",
      observationKind: "ASSIGNMENT",
      metadata: {},
    });
    expect(data.pagination.nextCursor).toBeNull();
  });

  it("resolves an identifier", async () => {
    const data = fresh(await api.resolve("FR*ABC"));
    expect(data.input).toBe("FRABC");
    expect(data.party?.roles[0]?.issuing.confirmation).toBe("CONFIRMED");
  });

  it("answers 304 to the ETag it returned", async () => {
    const first = await api.country("FR");
    const etag = first.headers.etag;
    if (first.notModified || !etag) throw new Error("Expected a fresh first answer with an ETag.");

    const second = await api.country("FR", { ifNoneMatch: etag });

    expect(second.notModified).toBe(true);
    expect(second.headers.etag).toBe(etag);
  });

  it("raises the API's 404 envelope as an http ApiError", async () => {
    const error: unknown = await api.party("FR", "ZZZ").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: "http",
      status: 404,
      envelope: { code: "PARTY_NOT_FOUND" },
    });
    const { requestId, envelope } = error as ApiError;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(envelope?.requestId).toBe(requestId);
  });
});
