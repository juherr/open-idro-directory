import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, type ApiFetcher } from "../src/index.js";

const BASE_URL = "https://api.internal";

const META = {
  datasetReleaseId: "release-1",
  generatedAt: "2026-11-01T00:00:00.000Z",
  schemaVersion: "1.4.0",
};

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

function recordingFetcher(respond: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const fetcher: ApiFetcher = async (input, init) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetcher };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Never settles on its own: rejects with the signal's reason once it aborts. */
const hangingFetcher: ApiFetcher = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

/** Answers 200 at once, then never finishes the body until the signal aborts. */
const hangingBodyFetcher: ApiFetcher = async (_input, init) => {
  const signal = init?.signal;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"data":'));
      signal?.addEventListener("abort", () => controller.error(signal.reason), { once: true });
    },
  });
  return new Response(body, { status: 200 });
};

/** Answers 200 at once with a body that never closes and ignores the signal. */
const deafBodyFetcher: ApiFetcher = async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"data":'));
    },
  });
  return new Response(body, { status: 200 });
};

/** Counts the abort listeners added to and removed from `signal`. */
function abortListenerBalance(signal: AbortSignal) {
  const added = vi.spyOn(signal, "addEventListener");
  const removed = vi.spyOn(signal, "removeEventListener");
  const count = (spy: typeof added | typeof removed) =>
    spy.mock.calls.filter(([type]) => type === "abort").length;
  return () => count(added) - count(removed);
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createApiClient request building", () => {
  it("joins the base URL and the path, and sends Accept: application/json with GET", async () => {
    const { calls, fetcher } = recordingFetcher(() => jsonResponse({ data: {}, meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: `${BASE_URL}/` });

    await client.request("/api/v1/stats");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${BASE_URL}/api/v1/stats`);
    expect(calls[0]?.init?.method).toBe("GET");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("serialises the query in sorted key order, omits undefined values and encodes them", async () => {
    const { calls, fetcher } = recordingFetcher(() => jsonResponse({ data: [], meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    await client.request("/api/v1/parties", {
      query: { q: "a&b c", country: "FR", cursor: undefined, limit: 25, active: true },
    });

    expect(calls[0]?.url).toBe(
      `${BASE_URL}/api/v1/parties?active=true&country=FR&limit=25&q=a%26b+c`,
    );
  });

  it("sends no query string when every value is undefined", async () => {
    const { calls, fetcher } = recordingFetcher(() => jsonResponse({ data: [], meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    await client.request("/api/v1/parties", { query: { cursor: undefined } });

    expect(calls[0]?.url).toBe(`${BASE_URL}/api/v1/parties`);
  });

  it("sends If-None-Match only when the caller gives one", async () => {
    const { calls, fetcher } = recordingFetcher(() => jsonResponse({ data: {}, meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    await client.request("/api/v1/stats");
    await client.request("/api/v1/stats", { ifNoneMatch: '"abc"' });

    expect(new Headers(calls[0]?.init?.headers).has("If-None-Match")).toBe(false);
    expect(new Headers(calls[1]?.init?.headers).get("If-None-Match")).toBe('"abc"');
  });

  it("defaults the base URL to globalThis.location.origin", async () => {
    vi.stubGlobal("location", { origin: "https://idro.example" });
    try {
      const { calls, fetcher } = recordingFetcher(() => jsonResponse({ data: {}, meta: META }));
      const client = createApiClient({ fetch: fetcher });

      await client.request("/api/v1");

      expect(calls[0]?.url).toBe("https://idro.example/api/v1");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses to build a client without a base URL", () => {
    const { fetcher } = recordingFetcher(() => jsonResponse({}));
    expect(() => createApiClient({ fetch: fetcher })).toThrow(TypeError);
  });

  it("defaults the fetcher to the global fetch", async () => {
    const globalFetch = vi.fn(async () => jsonResponse({ data: {}, meta: META }));
    vi.stubGlobal("fetch", globalFetch);
    try {
      const client = createApiClient({ baseUrl: BASE_URL });

      await client.request("/api/v1");

      expect(globalFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("createApiClient results", () => {
  it("returns data, body meta and header metadata on success", async () => {
    const { fetcher } = recordingFetcher(() =>
      jsonResponse({ data: { total: 3 }, meta: META }, 200, {
        ETag: '"etag-1"',
        "X-Dataset-Release": "release-1",
        "X-Registry-Schema-Version": "1.4.0",
        "X-Request-Id": "req-1",
        "Cache-Control": "public, max-age=300",
      }),
    );
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const result = await client.request<{ total: number }>("/api/v1/stats");

    expect(result).toEqual({
      notModified: false,
      data: { total: 3 },
      meta: META,
      headers: {
        etag: '"etag-1"',
        datasetRelease: "release-1",
        schemaVersion: "1.4.0",
        requestId: "req-1",
        cacheControl: "public, max-age=300",
      },
    });
  });

  it("reports absent metadata headers as undefined", async () => {
    const { fetcher } = recordingFetcher(() => jsonResponse({ data: {}, meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const result = await client.request("/api/v1/stats");

    expect(result.headers).toEqual({
      etag: undefined,
      datasetRelease: undefined,
      schemaVersion: undefined,
      requestId: undefined,
      cacheControl: undefined,
    });
  });

  it("returns a notModified result carrying header metadata on 304", async () => {
    const { fetcher } = recordingFetcher(
      () =>
        new Response(null, {
          status: 304,
          headers: { ETag: '"etag-1"', "X-Request-Id": "req-304", "Cache-Control": "no-cache" },
        }),
    );
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const result = await client.request("/api/v1/stats", { ifNoneMatch: '"etag-1"' });

    expect(result).toEqual({
      notModified: true,
      headers: {
        etag: '"etag-1"',
        datasetRelease: undefined,
        schemaVersion: undefined,
        requestId: "req-304",
        cacheControl: "no-cache",
      },
    });
  });
});

describe("createApiClient errors", () => {
  it("raises an http ApiError with the parsed envelope on a 4xx envelope", async () => {
    const { fetcher } = recordingFetcher(() =>
      jsonResponse(
        {
          error: {
            code: "INVALID_QUERY",
            message: "limit must be at most 100.",
            details: { field: "limit" },
            requestId: "req-envelope",
          },
        },
        400,
        { "X-Request-Id": "req-header", "Cache-Control": "no-store" },
      ),
    );
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const error = await captureError(client.request("/api/v1/parties"));

    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("http");
    expect(error.status).toBe(400);
    expect(error.requestId).toBe("req-header");
    expect(error.envelope).toEqual({
      code: "INVALID_QUERY",
      message: "limit must be at most 100.",
      details: { field: "limit" },
      requestId: "req-envelope",
    });
    expect(error.message).toBe("limit must be at most 100.");
  });

  it("falls back to the envelope request id when X-Request-Id is absent", async () => {
    const { fetcher } = recordingFetcher(() =>
      jsonResponse(
        { error: { code: "PARTY_NOT_FOUND", message: "Not found.", requestId: "req-envelope" } },
        404,
      ),
    );
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const error = await captureError(client.request("/api/v1/parties/FR/ABC"));

    expect(error.kind).toBe("http");
    expect(error.status).toBe(404);
    expect(error.requestId).toBe("req-envelope");
    expect(error.envelope?.details).toBeUndefined();
  });

  it("raises an http ApiError without envelope on a 5xx non-JSON body", async () => {
    const { fetcher } = recordingFetcher(
      () =>
        new Response("<html>Bad gateway</html>", {
          status: 502,
          headers: { "Content-Type": "text/html", "X-Request-Id": "req-edge" },
        }),
    );
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const error = await captureError(client.request("/api/v1/stats"));

    expect(error.kind).toBe("http");
    expect(error.status).toBe(502);
    expect(error.requestId).toBe("req-edge");
    expect(error.envelope).toBeUndefined();
  });

  it("raises an http ApiError without envelope on a JSON body that is not an envelope", async () => {
    const { fetcher } = recordingFetcher(() => jsonResponse({ message: "nope" }, 503));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const error = await captureError(client.request("/api/v1/stats"));

    expect(error.kind).toBe("http");
    expect(error.status).toBe(503);
    expect(error.requestId).toBeUndefined();
    expect(error.envelope).toBeUndefined();
  });

  it("raises an invalid-json ApiError on a 2xx body that is not JSON", async () => {
    const { fetcher } = recordingFetcher(
      () => new Response("not json", { status: 200, headers: { "X-Request-Id": "req-bad" } }),
    );
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const error = await captureError(client.request("/api/v1/stats"));

    expect(error.kind).toBe("invalid-json");
    expect(error.status).toBe(200);
    expect(error.requestId).toBe("req-bad");
    expect(error.envelope).toBeUndefined();
    expect(error.cause).toBeInstanceOf(SyntaxError);
  });

  it("raises a network ApiError when the fetcher rejects", async () => {
    const failure = new TypeError("fetch failed");
    const fetcher: ApiFetcher = async () => {
      throw failure;
    };
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const error = await captureError(client.request("/api/v1/stats"));

    expect(error.kind).toBe("network");
    expect(error.status).toBeUndefined();
    expect(error.requestId).toBeUndefined();
    expect(error.cause).toBe(failure);
  });
});

describe("createApiClient timeout and abort", () => {
  it("times out after 10 000 ms by default", async () => {
    vi.useFakeTimers();
    const client = createApiClient({ fetch: hangingFetcher, baseUrl: BASE_URL });

    const pending = captureError(client.request("/api/v1/stats"));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    const error = await pending;

    expect(error.kind).toBe("timeout");
    expect(error.status).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("honours a configured timeout", async () => {
    vi.useFakeTimers();
    const client = createApiClient({ fetch: hangingFetcher, baseUrl: BASE_URL, timeoutMs: 500 });

    const pending = captureError(client.request("/api/v1/stats"));
    await vi.advanceTimersByTimeAsync(500);

    expect((await pending).kind).toBe("timeout");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("covers the body read with the timeout", async () => {
    vi.useFakeTimers();
    const client = createApiClient({
      fetch: hangingBodyFetcher,
      baseUrl: BASE_URL,
      timeoutMs: 500,
    });

    const pending = captureError(client.request("/api/v1/stats"));
    await vi.advanceTimersByTimeAsync(500);

    expect((await pending).kind).toBe("timeout");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out a body read the fetcher does not wire to the signal", async () => {
    vi.useFakeTimers();
    const client = createApiClient({ fetch: deafBodyFetcher, baseUrl: BASE_URL, timeoutMs: 500 });
    const caller = new AbortController();
    const listenersLeft = abortListenerBalance(caller.signal);

    const pending = captureError(client.request("/api/v1/stats", { signal: caller.signal }));
    await vi.advanceTimersByTimeAsync(500);
    const error = await pending;

    expect(error.kind).toBe("timeout");
    expect(vi.getTimerCount()).toBe(0);
    expect(listenersLeft()).toBe(0);
  });

  it("reports a caller abort during a deaf body read as aborted", async () => {
    vi.useFakeTimers();
    const client = createApiClient({ fetch: deafBodyFetcher, baseUrl: BASE_URL });
    const caller = new AbortController();
    const listenersLeft = abortListenerBalance(caller.signal);

    const pending = captureError(client.request("/api/v1/stats", { signal: caller.signal }));
    await vi.advanceTimersByTimeAsync(100);
    caller.abort();
    const error = await pending;

    expect(error.kind).toBe("aborted");
    expect(vi.getTimerCount()).toBe(0);
    expect(listenersLeft()).toBe(0);
  });

  it("reports a caller abort as aborted, not as a timeout", async () => {
    vi.useFakeTimers();
    const client = createApiClient({ fetch: hangingFetcher, baseUrl: BASE_URL });
    const controller = new AbortController();

    const pending = captureError(client.request("/api/v1/stats", { signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    const error = await pending;

    expect(error.kind).toBe("aborted");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a signal aborted before the call as aborted", async () => {
    vi.useFakeTimers();
    const { calls, fetcher } = recordingFetcher(() => jsonResponse({ data: {}, meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    const error = await captureError(
      client.request("/api/v1/stats", { signal: AbortSignal.abort() }),
    );

    expect(error.kind).toBe("aborted");
    expect(calls).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no timer pending after a success", async () => {
    vi.useFakeTimers();
    const { fetcher } = recordingFetcher(() => jsonResponse({ data: {}, meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    await client.request("/api/v1/stats");

    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no timer pending after an http failure", async () => {
    vi.useFakeTimers();
    const { fetcher } = recordingFetcher(() => new Response("oops", { status: 500 }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    await captureError(client.request("/api/v1/stats"));

    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes an abort signal to the fetcher", async () => {
    const { calls, fetcher } = recordingFetcher(() => jsonResponse({ data: {}, meta: META }));
    const client = createApiClient({ fetch: fetcher, baseUrl: BASE_URL });

    await client.request("/api/v1/stats");

    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});
