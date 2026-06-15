import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  conflictPayload,
  countMap,
  datasetPayload,
  listPayload,
  observationPayload,
  partyPayload,
  sourcePayload,
} from "../application/mappers.js";
import {
  API_PREFIX,
  API_VERSION,
  CACHE_CONTROL,
  DISCLAIMER,
  REPOSITORY_URL,
  SCHEMA_VERSION,
} from "../domain/constants.js";
import { decodeCursor } from "../domain/cursor.js";
import { makeEtag } from "../domain/etag.js";
import { RegistryRepository } from "../infrastructure/d1/repository.js";
import { openApiDocument } from "../openapi/document.js";
import { docsHtml } from "./docs.js";
import { ApiError, errorResponse } from "./errors.js";
import {
  conflictQuerySchema,
  observationQuerySchema,
  parseCountryParty,
  parseQuery,
  partyListQuerySchema,
} from "./validation.js";

export interface Env {
  REGISTRY_DB: D1Database;
}

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: { requestId: string } }>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      allowHeaders: ["Accept", "If-None-Match"],
      exposeHeaders: ["ETag", "X-Dataset-Release", "X-Registry-Schema-Version", "X-Request-Id"],
      credentials: false,
    }),
  );

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    c.header("X-Registry-Schema-Version", SCHEMA_VERSION);
    await next();
  });

  app.get("/openapi.json", (c) => c.json(openApiDocument(new URL(c.req.url).origin)));
  app.get("/docs", (c) => c.html(docsHtml()));

  app.get(API_PREFIX, async (c) =>
    withDataset(c, CACHE_CONTROL.dataset, async ({ release }) => ({
      name: "Open IDRO Directory API",
      version: API_VERSION,
      disclaimer: DISCLAIMER,
      dataset: datasetPayload(release),
      links: {
        openapi: "/openapi.json",
        docs: "/docs",
        health: `${API_PREFIX}/health`,
        dataset: `${API_PREFIX}/dataset`,
        sources: `${API_PREFIX}/sources`,
        parties: `${API_PREFIX}/parties`,
        stats: `${API_PREFIX}/stats`,
        github: REPOSITORY_URL,
      },
    })),
  );

  app.get(`${API_PREFIX}/health`, async (c) => {
    const repo = new RegistryRepository(c.env.REGISTRY_DB);
    const release = await repo.activeRelease();
    c.header("Cache-Control", CACHE_CONTROL.health);
    if (!release) throw new ApiError(503, "NO_ACTIVE_DATASET", "No active dataset is available.");
    c.header("X-Dataset-Release", release.id);
    return c.json({ data: { status: "ok" }, meta: meta(release) });
  });

  app.get(`${API_PREFIX}/dataset`, async (c) =>
    withDataset(c, CACHE_CONTROL.dataset, async ({ release }) => datasetPayload(release)),
  );

  app.get(`${API_PREFIX}/parties`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const query = parseQuery(partyListQuerySchema, c.req.query());
      const result = await repo.listParties(release.id, {
        ...query,
        cursor: decodeCursor(query.cursor),
      });
      return listPayload(result.items, result.nextCursor, (party) => partyPayload(party));
    }),
  );

  app.get(`${API_PREFIX}/parties/:countryCode/:partyId`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const id = parseCountryParty(c.req.param("countryCode"), c.req.param("partyId"));
      const party = await repo.getParty(release.id, id.countryCode, id.partyId);
      if (!party) throw new ApiError(404, "PARTY_NOT_FOUND", "Party not found.");
      const roles = await repo.getPartyRoles(release.id, party.key);
      const observations = await repo.listPartyObservations(release.id, party.key, { limit: 200 });
      const conflicts = await repo.listPartyConflicts(release.id, party.key, { limit: 200 });
      return {
        ...partyPayload(party, roles),
        alternativeNames: unique(
          observations.items.map((row) => row.organization_name).filter(isString),
        ),
        sourceSummary: unique(observations.items.map((row) => row.source_id)),
        conflictSummary: {
          count: conflicts.items.length,
          severities: unique(conflicts.items.map((row) => row.severity)),
        },
        freshnessSummary: {
          latestRetrievedAt:
            observations.items
              .map((row) => row.retrieved_at)
              .sort()
              .at(-1) ?? null,
        },
        links: {
          observations: `${API_PREFIX}/parties/${party.country_code}/${party.party_id}/observations`,
          conflicts: `${API_PREFIX}/parties/${party.country_code}/${party.party_id}/conflicts`,
        },
      };
    }),
  );

  app.get(`${API_PREFIX}/parties/:countryCode/:partyId/observations`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const id = parseCountryParty(c.req.param("countryCode"), c.req.param("partyId"));
      const party = await repo.getParty(release.id, id.countryCode, id.partyId);
      if (!party) throw new ApiError(404, "PARTY_NOT_FOUND", "Party not found.");
      const query = parseQuery(observationQuerySchema, c.req.query());
      const result = await repo.listPartyObservations(release.id, party.key, {
        ...query,
        cursor: decodeCursor(query.cursor),
      });
      return listPayload(result.items, result.nextCursor, observationPayload);
    }),
  );

  app.get(`${API_PREFIX}/parties/:countryCode/:partyId/conflicts`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const id = parseCountryParty(c.req.param("countryCode"), c.req.param("partyId"));
      const party = await repo.getParty(release.id, id.countryCode, id.partyId);
      if (!party) throw new ApiError(404, "PARTY_NOT_FOUND", "Party not found.");
      const query = parseQuery(
        conflictQuerySchema.omit({ country: true, source: true }),
        c.req.query(),
      );
      const result = await repo.listPartyConflicts(release.id, party.key, {
        ...query,
        cursor: decodeCursor(query.cursor),
      });
      return listPayload(result.items, result.nextCursor, conflictPayload);
    }),
  );

  app.get(`${API_PREFIX}/sources`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => ({
      items: (await repo.listSources(release.id)).map(sourcePayload),
    })),
  );

  app.get(`${API_PREFIX}/sources/:sourceId`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const source = await repo.getSource(release.id, c.req.param("sourceId"));
      if (!source) throw new ApiError(404, "SOURCE_NOT_FOUND", "Source not found.");
      return sourcePayload(source);
    }),
  );

  app.get(`${API_PREFIX}/sources/:sourceId/health`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const source = await repo.getSource(release.id, c.req.param("sourceId"));
      if (!source) throw new ApiError(404, "SOURCE_NOT_FOUND", "Source not found.");
      return sourcePayload(source).health;
    }),
  );

  app.get(`${API_PREFIX}/sources/:sourceId/parties`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const source = await repo.getSource(release.id, c.req.param("sourceId"));
      if (!source) throw new ApiError(404, "SOURCE_NOT_FOUND", "Source not found.");
      const query = parseQuery(partyListQuerySchema, { ...c.req.query(), source: source.id });
      const result = await repo.listParties(release.id, {
        ...query,
        source: source.id,
        cursor: decodeCursor(query.cursor),
      });
      return listPayload(result.items, result.nextCursor, (party) => partyPayload(party));
    }),
  );

  app.get(`${API_PREFIX}/conflicts`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const query = parseQuery(conflictQuerySchema, c.req.query());
      const result = await repo.listConflicts(release.id, {
        ...query,
        cursor: decodeCursor(query.cursor),
      });
      return listPayload(result.items, result.nextCursor, conflictPayload);
    }),
  );

  app.get(`${API_PREFIX}/stats`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const stats = await repo.stats(release.id);
      return {
        totalParties: stats.totals?.parties ?? 0,
        totalObservations: stats.totals?.observations ?? 0,
        totalConflicts: stats.totals?.conflicts ?? 0,
        countsByCountry: countMap(stats.countries),
        countsByIdentifierCountry: countMap(stats.identifierCountries),
        countsByRole: countMap(stats.roles),
        countsByStatus: countMap(stats.statuses),
        countsByAuthorityLevel: countMap(stats.authorityLevels),
        countsBySource: countMap(stats.sources),
        conflictCounts: countMap(stats.conflicts),
        datasetTimestamp: release.generated_at,
      };
    }),
  );

  app.get(`${API_PREFIX}/resolve/:emobilityId`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const raw = c.req.param("emobilityId").toUpperCase();
      const match = /^([A-Z]{2})([A-Z0-9*]{3})$/.exec(raw);
      if (!match) {
        throw new ApiError(
          422,
          "UNSUPPORTED_IDENTIFIER",
          "Only normalized five-character party identifiers are supported.",
        );
      }
      const party = await repo.getParty(release.id, match[1] as string, match[2] as string);
      return {
        input: raw,
        warnings: [],
        ambiguous: false,
        party: party ? partyPayload(party, await repo.getPartyRoles(release.id, party.key)) : null,
      };
    }),
  );

  app.notFound((c) =>
    errorResponse(
      c,
      new ApiError(404, "ROUTE_NOT_FOUND", "Route not found."),
      c.get("requestId") ?? crypto.randomUUID(),
    ),
  );

  app.onError((error, c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    if (error instanceof ApiError) return errorResponse(c, error, requestId);
    console.error(
      JSON.stringify({
        requestId,
        route: c.req.path,
        status: 500,
        errorCode: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return errorResponse(
      c,
      new ApiError(500, "INTERNAL_ERROR", "Unexpected server failure."),
      requestId,
    );
  });

  return app;
}

type ApiContext = Context<{ Bindings: Env; Variables: { requestId: string } }>;
type ActiveRelease = NonNullable<Awaited<ReturnType<RegistryRepository["activeRelease"]>>>;

async function withDataset<T>(
  c: ApiContext,
  cacheControl: string,
  handler: (context: { repo: RegistryRepository; release: ActiveRelease }) => Promise<T>,
) {
  const repo = new RegistryRepository(c.env.REGISTRY_DB);
  const release = await repo.activeRelease();
  if (!release) throw new ApiError(503, "NO_ACTIVE_DATASET", "No active dataset is available.");
  c.header("X-Dataset-Release", release.id);
  c.header("Cache-Control", cacheControl);
  const etag = await makeEtag(release.dataset_checksum, c.req.url);
  c.header("ETag", etag);
  if (c.req.header("If-None-Match") === etag) return c.body(null, 304);
  const data = await handler({ repo, release });
  return c.json({ data, meta: meta(release) });
}

function meta(release: ActiveRelease) {
  return {
    datasetReleaseId: release.id,
    generatedAt: release.generated_at,
    schemaVersion: release.schema_version,
  };
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
