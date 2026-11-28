import { describe, expect, it, vi } from "vitest";
import { makeEtag } from "../src/domain/etag.js";
import { createApp, type Env } from "../src/http/app.js";
import { renderCountryPage } from "../src/http/pages/country-page.js";
import worker from "../src/index.js";
import type { SourceRow } from "../src/infrastructure/d1/types.js";
import { fakeD1, first, release, source, type FakeD1Options } from "./support/api-fixtures.js";

// Passthrough, so a test can make the renderer fail after the success headers are set.
vi.mock("../src/http/pages/country-page.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/http/pages/country-page.js")>();
  return { ...original, renderCountryPage: vi.fn(original.renderCountryPage) };
});

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

  it("returns 304 when an If-None-Match list holds the weak form of the ETag", async () => {
    const first = await request("/api/v1/dataset");
    const second = await request("/api/v1/dataset", {
      headers: { "If-None-Match": `"other", W/${first.headers.get("etag") ?? ""}` },
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

  it("rejects an unsupported identifier even when If-None-Match is *", async () => {
    const response = await request("/api/v1/resolve/FRABC123456", {
      headers: { "If-None-Match": "*" },
    });
    expect(response.status).toBe(422);
  });

  it("falls back to the source row when the authority join misses", async () => {
    // Between migration 0004 and the next import, sources.authority_id is NULL for
    // every row, so the LEFT JOIN yields no authority columns. The response must
    // still describe the source rather than reporting a nameless authority.
    const unjoined: SourceRow = {
      ...source,
      authority_id: null,
      joined_authority_name: null,
      joined_authority_level: null,
      authority_jurisdictions_json: null,
      authority_homepage_url: null,
      authority_notes: null,
    };
    const db = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => (sql.includes("FROM sources") ? unjoined : first(sql, [], release)),
          all: async () => ({ results: [] }),
        }),
      }),
    } as unknown as D1Database;
    const app = createApp();
    const response = await app.request("/api/v1/sources/fr-afirev", undefined, {
      REGISTRY_DB: db,
    } satisfies Env);
    const body = (await response.json()) as {
      data: {
        authority: { name: string; level: string; jurisdictions: string[]; homepageUrl: string };
        authorityName: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.authority).toMatchObject({
      name: "AFIREV",
      level: "AUTHORITATIVE",
      jurisdictions: ["FR"],
      homepageUrl: "https://afirev.fr/",
    });
    expect(body.data.authorityName).toBe("AFIREV");
  });

  it("rejects unknown query filters", async () => {
    const response = await request("/api/v1/parties?unknown=1");
    expect(response.status).toBe(400);
  });

  it("exposes source health, observations, conflicts, stats and OpenAPI", async () => {
    const sourceResponse = await request("/api/v1/sources/fr-afirev");
    const sourceBody = (await sourceResponse.json()) as {
      data: {
        authority: { id: string; name: string; level: string; homepageUrl: string };
        registry: { url: string; observationType: string };
        publication: { machineReadableUrl: string; verifiedAt: string };
        machineReadableUrl: string;
        verifiedAt: string;
        reuse: {
          status: string;
          licence: { name: string; url: string };
          attributionNotice: string;
          redistributionAllowed: boolean;
          notes: null;
        };
        disclaimer: string;
      };
    };
    expect(sourceBody.data).toMatchObject({
      authority: {
        id: "fr-afirev",
        name: "AFIREV",
        level: "AUTHORITATIVE",
        homepageUrl: "https://afirev.fr/",
      },
      registry: {
        url: "https://api.afirev.fr/public/prefixes",
        observationType: "OFFICIAL_ASSIGNMENT",
      },
      publication: {
        machineReadableUrl: "https://api.afirev.fr/public/prefixes",
        verifiedAt: "2026-01-02",
      },
      machineReadableUrl: "https://api.afirev.fr/public/prefixes",
      verifiedAt: "2026-01-02",
      reuse: {
        status: "licensed",
        licence: {
          name: "CC BY 4.0",
          url: "https://creativecommons.org/licenses/by/4.0/",
        },
        attributionNotice: "Cite the source.",
        redistributionAllowed: true,
        notes: null,
      },
    });
    expect(sourceBody.data).not.toHaveProperty("license");
    expect(sourceBody.data.disclaimer).toContain("independent aggregation");
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

  it("serves a country summary", async () => {
    const response = await request("/api/v1/countries/fr");
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toMatch(/^"/);
    const body = (await response.json()) as {
      data: Record<string, unknown> & { sources: Array<Record<string, unknown>> };
      meta: { datasetReleaseId: string };
    };

    expect(body.meta.datasetReleaseId).toBe(release.id);
    expect(body.data).toMatchObject({
      countryCode: "FR",
      authorities: [{ id: "fr-afirev", name: "AFIREV", level: "AUTHORITATIVE" }],
      coverage: { status: "PUBLISHED", declaredRoles: ["CPO", "EMSP"], publishedRoles: { CPO: 1 } },
      statistics: { parties: 1, partyRoles: 1, observations: 2, conflicts: 1 },
      datasetTimestamp: release.generated_at,
    });
    expect(body.data.sources).toEqual([
      expect.objectContaining({
        id: "fr-afirev",
        countryObservations: { total: 2, byAuthorityLevel: { AUTHORITATIVE: 2 } },
      }),
    ]);
  });

  it("returns a documented error for an unknown country", async () => {
    const response = await request("/api/v1/countries/ZZ");
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("COUNTRY_NOT_FOUND");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("etag")).toBeNull();
  });

  it("never revalidates a JSON error into a 304", async () => {
    const response = await request("/api/v1/countries/ZZ", {
      headers: { "If-None-Match": "*" },
    });
    expect(response.status).toBe(404);
  });

  it("rejects a malformed country code", async () => {
    const response = await request("/api/v1/countries/F1");
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_COUNTRY_CODE");
  });

  it("documents the country summary and its errors in OpenAPI", async () => {
    const document = (await (await request("/openapi.json")).json()) as {
      paths: Record<string, { get: { responses: Record<string, unknown> } }>;
      components: { schemas: Record<string, { required?: string[] }> };
    };
    const responses = document.paths["/api/v1/countries/{countryCode}"]?.get.responses;
    const errorSchema = { $ref: "#/components/schemas/ErrorResponse" };

    expect(JSON.stringify(responses?.["200"])).toContain("#/components/schemas/CountrySummary");
    expect(responses?.["404"]).toMatchObject({
      description: expect.stringContaining("COUNTRY_NOT_FOUND"),
      content: { "application/json": { schema: errorSchema } },
    });
    expect(responses?.["422"]).toMatchObject({
      description: expect.stringContaining("INVALID_COUNTRY_CODE"),
      content: { "application/json": { schema: errorSchema } },
    });

    const summary = (await (await request("/api/v1/countries/FR")).json()) as {
      data: Record<string, unknown>;
    };
    expect(document.components.schemas.CountrySummary?.required?.slice().sort()).toEqual(
      Object.keys(summary.data).sort(),
    );
    expect(document.components.schemas.SourceRegistry?.required).toContain("supportedRoles");
  });

  it("declares a required path parameter for every path template variable", async () => {
    const document = (await (await request("/openapi.json")).json()) as {
      paths: Record<string, { get: { parameters?: Array<Record<string, unknown>> } }>;
    };

    expect(document.paths["/api/v1/countries/{countryCode}"]?.get.parameters).toEqual([
      { name: "countryCode", in: "path", required: true, schema: { type: "string" } },
    ]);
    for (const [path, item] of Object.entries(document.paths)) {
      const variables = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
      expect(item.get.parameters ?? [], path).toEqual(
        variables.map((name) => ({ name, in: "path", required: true, schema: { type: "string" } })),
      );
    }
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

  it("serves a server-rendered country page on the canonical path", async () => {
    const response = await workerRequest("/countries/fr/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("x-dataset-release")).toBe(release.id);
    expect(response.headers.get("cache-control")).toContain("max-age=3600");
    const page = await response.text();
    expect(page).toContain("France");
    expect(page).toContain("AFIREV");
    expect(page).toContain("https://api.afirev.fr/public/prefixes");
    expect(page).toContain('href="/explore/?country=FR"');
    expect(page).toContain('data-fixed-country="FR"');
    expect(page).toContain('<script type="module" src="/explorer.js"></script>');
  });

  it("revalidates country pages with an ETag distinct from the JSON summary", async () => {
    const first = await workerRequest("/countries/fr/");
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^"/);
    expect(etag).not.toBe(
      await makeEtag(
        `${release.id}:${release.dataset_checksum}`,
        "https://example.test/countries/fr/",
      ),
    );

    const revalidated = await workerRequest("/countries/fr/", {
      headers: { "If-None-Match": etag ?? "" },
    });
    expect(revalidated.status).toBe(304);

    const listed = await workerRequest("/countries/fr/", {
      headers: { "If-None-Match": `"other", ${etag ?? ""}` },
    });
    expect(listed.status).toBe(304);
  });

  it.each(["/countries/fr/", "/api/v1/dataset", "/api/v1/sources"])(
    "does not revalidate %s across releases that share a dataset checksum",
    async (path) => {
      const etag = (await workerRequest(path)).headers.get("etag");
      expect(etag).toMatch(/^"/);

      const next = { ...release, id: "release-2", generated_at: "2026-06-16T06:39:47.501Z" };
      const response = await workerRequest(
        path,
        { headers: { "If-None-Match": etag ?? "" } },
        { activeRelease: next },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("x-dataset-release")).toBe("release-2");
    },
  );

  it.each([
    ["/countries/fr/?lang=fr", "fr"],
    ["/countries/fr/?lang=en", "en"],
    ["/countries/fr/", "en"],
    ["/countries/fr/?lang=xx", "en"],
  ])("serves %s in the %s page language", async (path, lang) => {
    const response = await workerRequest(path);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain(`<html lang="${lang}">`);
  });

  it.each([
    [
      "/countries/fr/?lang=fr&q=x&role=CPO&status=ACTIVE",
      "https://example.test/countries/fr/?lang=fr",
    ],
    ["/countries/fr/?q=x", "https://example.test/countries/fr/"],
    ["/countries/fr/?lang=xx", "https://example.test/countries/fr/"],
  ])("gives %s the canonical %s, built from the path country", async (path, canonical) => {
    const response = await workerRequest(path);
    const page = await response.text();

    expect(response.status).toBe(200);
    expect(page).toContain(`<link rel="canonical" href="${canonical}"`);
    expect(page).toContain(`<meta property="og:url" content="${canonical}"`);
    expect(page).not.toMatch(/href="[^"]*[?&](q|role|status)=/);
    const [, json] = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) ?? [];
    const breadcrumbs = JSON.parse(json ?? "null") as { itemListElement: { item: string }[] };
    expect(breadcrumbs.itemListElement.at(-1)?.item).toBe(canonical);
  });

  it.each([
    ["/countries/fr/", "/countries/fr/?lang=fr", "fr"],
    ["/countries/fr/?lang=fr", "/countries/fr/", "en"],
  ])("does not revalidate %s into %s", async (first, second, lang) => {
    const etag = (await workerRequest(first)).headers.get("etag");
    expect(etag).toMatch(/^"/);

    const response = await workerRequest(second, { headers: { "If-None-Match": etag ?? "" } });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain(`<html lang="${lang}">`);
  });

  it.each([
    ["/countries/FR/", "/countries/fr/"],
    ["/countries/fr", "/countries/fr/"],
    ["/countries/fr/?country=FR&q=total", "/countries/fr/?q=total"],
    ["/countries/FR/?lang=fr", "/countries/fr/?lang=fr"],
  ])("redirects %s to the canonical %s", async (path, location) => {
    const response = await workerRequest(path);

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(location);
  });

  it.each(["/countries/FR/?country=DE", "/countries/fr/?country=DE&lang=fr"])(
    "rejects a country parameter that conflicts with the path in %s",
    async (path) => {
      const response = await workerRequest(path);

      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("etag")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.text();
      expect(body).toContain('<html lang="en">');
      expect(body).toContain("Conflicting country");
    },
  );

  // Error pages stay English, even when the request asks for French.
  it.each([
    "/countries/zz/",
    "/countries/zz/?lang=fr",
    "/countries/fr/extra",
    "/countries/",
    "/countries/fra/",
  ])("returns an uncached HTML 404 for %s", async (path) => {
    const response = await workerRequest(path);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("etag")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).toContain('<html lang="en">');
    expect(body).toContain("Page not found");
  });

  it("serves a country 404 page that loads no script", async () => {
    const response = await workerRequest("/countries/zz/");

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.not.toMatch(/<script\b/i);
  });

  it("returns an HTML 503 for a country page when no dataset is active", async () => {
    const response = await workerRequest("/countries/fr/", undefined, { activeRelease: null });

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("drops the success ETag from an error raised after it was set", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    vi.mocked(renderCountryPage).mockRejectedValueOnce(new Error("render failed"));
    const response = await workerRequest("/countries/fr/");

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("etag")).toBeNull();
  });

  it("keeps the generic explorer URLs on static assets", async () => {
    const response = await workerRequest("/explore/?country=FR&q=total");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Explorateur de données");
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

function workerRequest(path: string, init?: RequestInit, options?: FakeD1Options) {
  return worker.fetch(
    new Request(`https://example.test${path}`, init) as Parameters<
      NonNullable<typeof worker.fetch>
    >[0],
    { REGISTRY_DB: fakeD1(options), ASSETS: fakeAssets() },
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
