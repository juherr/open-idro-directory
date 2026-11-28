import { afterEach, describe, expect, it, vi } from "vitest";

import { handleApiProxyRoute, isApiProxyPath, proxyToApi } from "../src/proxy/api-proxy.ts";

const origin = "https://web.example.test";

/** A service binding stub that records the request it receives. */
function apiStub(respond: (request: Request) => Response | Promise<Response>) {
  const calls: { request: Request; init: RequestInit | undefined }[] = [];
  const api = {
    fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      calls.push({ request, init });
      return respond(request);
    }),
    connect: vi.fn(),
  } as unknown as Fetcher;
  return { api, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isApiProxyPath", () => {
  it.each(["/api/", "/api/v1", "/api/v1/countries/fr", "/docs", "/openapi.json"])(
    "proxies %s",
    (path) => {
      expect(isApiProxyPath(path)).toBe(true);
    },
  );

  it.each([
    "/",
    "/api",
    "/apiary",
    "/docs/",
    "/docs/x",
    "/openapi.json/",
    "/openapi.yaml",
    "/countries/fr/",
  ])("leaves %s to the website", (path) => {
    expect(isApiProxyPath(path)).toBe(false);
  });
});

describe("handleApiProxyRoute", () => {
  it("proxies a proxied path", async () => {
    const { api, calls } = apiStub(() => new Response("spec", { status: 200 }));

    const response = await handleApiProxyRoute(new Request(`${origin}/openapi.json`), api);

    expect(calls).toHaveLength(1);
    expect(await response.text()).toBe("spec");
  });

  it.each(["/api", "/docs/", "/openapi.json/"])(
    "answers %s, which the route pattern also matches, with an uncacheable 404",
    async (path) => {
      const { api, calls } = apiStub(() => new Response("unexpected"));

      const response = await handleApiProxyRoute(new Request(`${origin}${path}`), api);

      expect(calls).toHaveLength(0);
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.has("ETag")).toBe(false);
    },
  );
});

describe("proxyToApi", () => {
  it("forwards the method, headers, body and query unchanged", async () => {
    const { api, calls } = apiStub(() => new Response("ok"));
    const request = new Request(`${origin}/api/v1/search?q=FR*ABC&limit=5`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Custom": "kept" },
      body: JSON.stringify({ hello: "world" }),
    });

    await proxyToApi(request, api);

    expect(calls).toHaveLength(1);
    const forwarded = calls[0]!.request;
    expect(forwarded.method).toBe("POST");
    expect(new URL(forwarded.url).pathname).toBe("/api/v1/search");
    expect(new URL(forwarded.url).search).toBe("?q=FR*ABC&limit=5");
    expect(forwarded.headers.get("Content-Type")).toBe("application/json");
    expect(forwarded.headers.get("X-Custom")).toBe("kept");
    expect(await forwarded.text()).toBe('{"hello":"world"}');
  });

  it("passes If-None-Match through and returns the API's 304 unchanged", async () => {
    const { api, calls } = apiStub(
      () =>
        new Response(null, {
          status: 304,
          headers: { ETag: '"abc"', "Cache-Control": "public, max-age=300" },
        }),
    );
    const request = new Request(`${origin}/api/v1/countries/fr`, {
      headers: { "If-None-Match": '"abc"' },
    });

    const response = await proxyToApi(request, api);

    expect(calls[0]!.request.headers.get("If-None-Match")).toBe('"abc"');
    expect(response.status).toBe(304);
    expect(response.headers.get("ETag")).toBe('"abc"');
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("does not follow an API redirect", async () => {
    const { api, calls } = apiStub(
      () => new Response(null, { status: 301, headers: { Location: "/api/v1/countries/fr" } }),
    );

    const response = await proxyToApi(new Request(`${origin}/api/v1/countries/FR`), api);

    expect(calls[0]!.request.redirect).toBe("manual");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/api/v1/countries/fr");
  });

  it("returns the API's status, headers and body unchanged and adds none", async () => {
    const apiHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      ETag: '"release-1"',
      "Cache-Control": "public, max-age=60",
      "X-Dataset-Release": "2026-11-28",
      "X-Request-Id": "req-123",
    };
    const { api } = apiStub(
      () => new Response('{"error":"nope"}', { status: 404, headers: apiHeaders }),
    );

    const response = await proxyToApi(new Request(`${origin}/api/v1/unknown`), api);

    expect(response.status).toBe(404);
    expect(Object.fromEntries(response.headers)).toEqual(
      Object.fromEntries(new Headers(apiHeaders)),
    );
    expect(await response.text()).toBe('{"error":"nope"}');
  });

  it("answers a binding failure with an uncacheable 502 error envelope", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { api } = apiStub(() => {
      throw new Error("binding down");
    });

    const response = await proxyToApi(new Request(`${origin}/api/v1`), api);

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.has("ETag")).toBe(false);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("API_UNAVAILABLE");
    expect(body.error.message).toEqual(expect.any(String));
    expect(body.error.requestId).toEqual(expect.any(String));
    expect(response.headers.get("X-Request-Id")).toBe(body.error.requestId);
    expect(error).toHaveBeenCalled();
  });

  it("never answers a binding failure with 304, even on a conditional request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { api } = apiStub(() => Promise.reject(new Error("binding down")));

    const response = await proxyToApi(
      new Request(`${origin}/docs`, { headers: { "If-None-Match": '"abc"' } }),
      api,
    );

    expect(response.status).toBe(502);
    expect(response.headers.has("ETag")).toBe(false);
  });
});
