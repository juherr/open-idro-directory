import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  conflictPayload,
  countMap,
  countrySummaryPayload,
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
import { ifNoneMatchMatches, makeEtag } from "../domain/etag.js";
import { parseEmobilityIdentifierInput } from "../domain/identifier.js";
import { RegistryRepository } from "../infrastructure/d1/repository.js";
import { openApiDocument } from "../openapi/document.js";
import { COUNTRY_PAGE_PREFIX, isCountryPagePath, resolveCountryPage } from "./country-route.js";
import { docsHtml } from "./docs.js";
import { ApiError, errorResponse } from "./errors.js";
import { renderCountryPage, renderErrorPage } from "./pages/country-page.js";
import {
  conflictQuerySchema,
  parseCountryCode,
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
        countries: `${API_PREFIX}/countries/{countryCode}`,
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
        sourceSummary: unique(observations.items.map((row) => row.source_id)).map((sourceId) => ({
          id: sourceId,
          url: `${API_PREFIX}/sources/${sourceId}`,
        })),
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
        totalPartyRoles: stats.totals?.partyRoles ?? 0,
        totalObservations: stats.totals?.observations ?? 0,
        totalConflicts: stats.totals?.conflicts ?? 0,
        countsByCountry: countMap(stats.identifierCountries),
        countsByIdentifierCountry: countMap(stats.identifierCountries),
        countsByPartyCountry: countMap(stats.countries),
        countsByRole: countMap(stats.roles),
        countsByStatus: countMap(stats.statuses),
        countsByAuthorityLevel: countMap(stats.authorityLevels),
        countsBySource: countMap(stats.sources),
        conflictCounts: countMap(stats.conflicts),
        datasetTimestamp: release.generated_at,
      };
    }),
  );

  app.get(`${API_PREFIX}/countries/:countryCode`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const countryCode = parseCountryCode(c.req.param("countryCode"));
      return loadCountrySummary(repo, release, countryCode);
    }),
  );

  const countryPage = async (c: ApiContext) => {
    const route = resolveCountryPage(new URL(c.req.url));
    if (route.kind === "redirect") return c.redirect(route.location, 301);
    if (route.kind === "conflict") {
      throw new ApiError(
        400,
        "CONFLICTING_COUNTRY",
        "The country query parameter names another country than the page path.",
      );
    }
    if (route.kind === "not-found") throw routeNotFound();

    const repo = new RegistryRepository(c.env.REGISTRY_DB);
    const release = await activeRelease(repo);
    // Loaded before any cache header is set, so a 404 is neither cached nor revalidated.
    const summary = await loadCountrySummary(repo, release, route.countryCode);
    c.header("X-Dataset-Release", release.id);
    c.header("Cache-Control", CACHE_CONTROL.default);
    // The page version keeps a markup-only deploy from being answered with a stale 304.
    const etag = await makeEtag(`${datasetValidator(release)}:${COUNTRY_PAGE_VERSION}`, c.req.url);
    c.header("ETag", etag);
    if (ifNoneMatchMatches(c.req.header("If-None-Match"), etag)) return c.body(null, 304);
    return c.html(await renderCountryPage(summary, new URL(c.req.url).origin));
  };
  app.get(COUNTRY_PAGE_PREFIX, countryPage);
  app.get(`${COUNTRY_PAGE_PREFIX}/*`, countryPage);

  app.get(`${API_PREFIX}/resolve/:emobilityId`, async (c) =>
    withDataset(c, CACHE_CONTROL.default, async ({ repo, release }) => {
      const parsed = parseEmobilityIdentifierInput(c.req.param("emobilityId"));
      if (!parsed) {
        throw new ApiError(
          422,
          "UNSUPPORTED_IDENTIFIER",
          "Only five-character party identifiers are supported.",
        );
      }
      const party = await repo.getParty(release.id, parsed.countryCode, parsed.partyId);
      return {
        input: parsed.emobilityId,
        warnings: [],
        ambiguous: false,
        party: party ? partyPayload(party, await repo.getPartyRoles(release.id, party.key)) : null,
      };
    }),
  );

  app.notFound((c) =>
    respondWithError(c, routeNotFound(), c.get("requestId") ?? crypto.randomUUID()),
  );

  app.onError((error, c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();
    if (error instanceof ApiError) return respondWithError(c, error, requestId);
    console.error(
      JSON.stringify({
        requestId,
        route: c.req.path,
        status: 500,
        errorCode: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return respondWithError(
      c,
      new ApiError(500, "INTERNAL_ERROR", "Unexpected server failure."),
      requestId,
    );
  });

  return app;
}

/** Bumped whenever the country page markup changes, so cached pages revalidate. */
const COUNTRY_PAGE_VERSION = "3";

type ApiContext = Context<{ Bindings: Env; Variables: { requestId: string } }>;
type ActiveRelease = NonNullable<Awaited<ReturnType<RegistryRepository["activeRelease"]>>>;

function routeNotFound() {
  return new ApiError(404, "ROUTE_NOT_FOUND", "Route not found.");
}

/** Country pages get HTML errors; the API keeps its JSON error envelope. */
async function respondWithError(c: ApiContext, error: ApiError, requestId: string) {
  // A heuristically cached 404 would outlive a release that adds the resource.
  c.header("Cache-Control", CACHE_CONTROL.error);
  // An error raised after the success headers were set must not keep their ETag.
  c.header("ETag", undefined);
  if (!isCountryPagePath(c.req.path)) return errorResponse(c, error, requestId);
  return c.html(await renderErrorPage(error.status, error.message, requestId), error.status);
}

async function activeRelease(repo: RegistryRepository) {
  const release = await repo.activeRelease();
  if (!release) throw new ApiError(503, "NO_ACTIVE_DATASET", "No active dataset is available.");
  return release;
}

async function loadCountrySummary(
  repo: RegistryRepository,
  release: ActiveRelease,
  countryCode: string,
) {
  const [sources, stats] = await Promise.all([
    repo.listSources(release.id),
    repo.countryStats(release.id, countryCode),
  ]);
  const summary = countrySummaryPayload(countryCode, sources, stats, release);
  if (!summary) {
    throw new ApiError(
      404,
      "COUNTRY_NOT_FOUND",
      "No source covers this country and no identifier carries it.",
    );
  }
  return summary;
}

async function withDataset<T>(
  c: ApiContext,
  cacheControl: string,
  handler: (context: { repo: RegistryRepository; release: ActiveRelease }) => Promise<T>,
) {
  const repo = new RegistryRepository(c.env.REGISTRY_DB);
  const release = await activeRelease(repo);
  // Run before any cache header is set, so an error is neither cached nor revalidated.
  const data = await handler({ repo, release });
  c.header("X-Dataset-Release", release.id);
  c.header("Cache-Control", cacheControl);
  const etag = await makeEtag(datasetValidator(release), c.req.url);
  c.header("ETag", etag);
  if (ifNoneMatchMatches(c.req.header("If-None-Match"), etag)) return c.body(null, 304);
  return c.json({ data, meta: meta(release) });
}

/**
 * The checksum covers the normalized records only. Source health and release metadata can
 * change between releases with the same records, so the release id is part of the validator.
 */
function datasetValidator(release: ActiveRelease) {
  return `${release.id}:${release.dataset_checksum}`;
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
