import { ApiError, parseErrorEnvelope } from "./errors.js";

/**
 * Structural on purpose: the SSR side passes the `API` service binding's `fetch`, the browser
 * the global `fetch`, and neither type has to be named here.
 */
export type ApiFetcher = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Defaults to the global `fetch`. */
  fetch?: ApiFetcher;
  /**
   * Origin the paths are resolved against. Defaults to `globalThis.location.origin` in a
   * browser. A service binding needs an absolute URL, so SSR passes a placeholder origin.
   */
  baseUrl?: string;
  /** Covers the whole exchange, body read included. Defaults to 10 000 ms. */
  timeoutMs?: number;
}

export type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue>;
  /** Sent as `If-None-Match` when given. */
  ifNoneMatch?: string;
  signal?: AbortSignal;
}

/** The metadata headers the API sets; each is `undefined` when the answer lacks it. */
export interface ResponseHeaders {
  etag: string | undefined;
  datasetRelease: string | undefined;
  schemaVersion: string | undefined;
  requestId: string | undefined;
  cacheControl: string | undefined;
}

/** The body `meta` every 2xx dataset answer carries (`meta()` in `apps/api/src/http/app.ts`). */
export interface ResponseMeta {
  datasetReleaseId: string;
  generatedAt: string;
  schemaVersion: string;
}

export interface FreshResult<T> {
  notModified: false;
  data: T;
  meta: ResponseMeta;
  headers: ResponseHeaders;
}

/** A 304 answer to `If-None-Match`: the cached copy is still current. */
export interface NotModifiedResult {
  notModified: true;
  headers: ResponseHeaders;
}

export type ApiResult<T> = FreshResult<T> | NotModifiedResult;

export interface ApiClient {
  /** GET `path` (starting with `/`) and return the `{ data, meta }` body with its headers. */
  request<T>(path: string, options?: RequestOptions): Promise<ApiResult<T>>;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = (options.baseUrl ?? browserOrigin())?.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new TypeError("createApiClient needs a baseUrl outside a browser.");
  }
  const fetcher: ApiFetcher = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    request: <T>(path: string, requestOptions: RequestOptions = {}) =>
      send<T>(
        fetcher,
        `${baseUrl}${path}${queryString(requestOptions.query)}`,
        timeoutMs,
        requestOptions,
      ),
  };
}

/** Sorted keys, `undefined` dropped, values form-encoded; empty string when nothing is left. */
export function queryString(query: Record<string, QueryValue> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const key of Object.keys(query).sort()) {
    const value = query[key];
    if (value !== undefined) params.append(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

async function send<T>(
  fetcher: ApiFetcher,
  url: string,
  timeoutMs: number,
  { ifNoneMatch, signal }: RequestOptions,
): Promise<ApiResult<T>> {
  if (signal?.aborted) {
    throw new ApiError({
      kind: "aborted",
      message: "The request was aborted.",
      cause: signal.reason,
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", forwardAbort, { once: true });

  const headers: Record<string, string> = { Accept: "application/json" };
  if (ifNoneMatch !== undefined) headers["If-None-Match"] = ifNoneMatch;

  const aborted = rejectOnAbort(controller.signal);
  try {
    let response: Response;
    let text: string;
    try {
      response = await fetcher(url, { method: "GET", headers, signal: controller.signal });
      const responseHeaders = readHeaders(response.headers);
      if (response.status === 304) return { notModified: true, headers: responseHeaders };
      // A fetcher may not wire the signal into the body stream: race the read against it.
      text = await Promise.race([response.text(), aborted.promise]);
    } catch (error) {
      throw transportError(error, timedOut, timeoutMs, signal);
    }
    return parseBody<T>(response, text);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
    aborted.dispose();
  }
}

/** A promise that rejects with the signal's reason once it aborts, and its cleanup. */
function rejectOnAbort(signal: AbortSignal) {
  let onAbort: () => void = () => {};
  const promise = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
  });
  // Only ever awaited through Promise.race; never leave the rejection unhandled.
  promise.catch(() => {});
  signal.addEventListener("abort", onAbort, { once: true });
  return { promise, dispose: () => signal.removeEventListener("abort", onAbort) };
}

function parseBody<T>(response: Response, text: string): FreshResult<T> {
  const headers = readHeaders(response.headers);
  let body: unknown;
  let parseError: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    parseError = error;
  }

  if (!response.ok) {
    const envelope = parseErrorEnvelope(body);
    throw new ApiError({
      kind: "http",
      message: envelope?.message ?? `The API answered HTTP ${response.status}.`,
      status: response.status,
      requestId: headers.requestId ?? envelope?.requestId,
      envelope,
    });
  }
  if (parseError !== undefined) {
    throw new ApiError({
      kind: "invalid-json",
      message: `The API answered HTTP ${response.status} with a body that is not JSON.`,
      status: response.status,
      requestId: headers.requestId,
      cause: parseError,
    });
  }

  // No runtime validation by design: the payload shape is the API's contract.
  const { data, meta } = body as { data: T; meta: ResponseMeta };
  return { notModified: false, data, meta, headers };
}

function transportError(
  error: unknown,
  timedOut: boolean,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): ApiError {
  if (timedOut) {
    return new ApiError({
      kind: "timeout",
      message: `The request timed out after ${timeoutMs} ms.`,
      cause: error,
    });
  }
  if (signal?.aborted) {
    return new ApiError({ kind: "aborted", message: "The request was aborted.", cause: error });
  }
  return new ApiError({ kind: "network", message: "The API could not be reached.", cause: error });
}

function readHeaders(headers: Headers): ResponseHeaders {
  return {
    etag: headers.get("ETag") ?? undefined,
    datasetRelease: headers.get("X-Dataset-Release") ?? undefined,
    schemaVersion: headers.get("X-Registry-Schema-Version") ?? undefined,
    requestId: headers.get("X-Request-Id") ?? undefined,
    cacheControl: headers.get("Cache-Control") ?? undefined,
  };
}

/** `location.origin` without depending on the DOM lib types. */
function browserOrigin(): string | undefined {
  const { location } = globalThis as { location?: { origin?: unknown } };
  return typeof location?.origin === "string" ? location.origin : undefined;
}
