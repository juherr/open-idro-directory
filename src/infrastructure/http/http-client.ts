import { setTimeout as sleep } from "node:timers/promises";
import { createHash } from "node:crypto";

export interface HttpClientOptions {
  timeoutMs: number;
  retries: number;
  maxBytes: number;
  allowedHosts: string[];
  userAgent: string;
}

export interface HttpResponse {
  body: string;
  contentType: string | null;
  finalUrl: string;
  status: number;
  checksum: string;
  etag: string | null;
  lastModified: string | null;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly category: "timeout" | "network" | "http" | "size" | "security",
    readonly status?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function getText(
  url: string,
  options: HttpClientOptions,
  conditionals: { etag?: string; lastModified?: string } = {},
): Promise<HttpResponse> {
  validateUrl(url, options.allowedHosts);
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
      const headers: Record<string, string> = { "User-Agent": options.userAgent };
      if (conditionals.etag) headers["If-None-Match"] = conditionals.etag;
      if (conditionals.lastModified) headers["If-Modified-Since"] = conditionals.lastModified;
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeout);
      validateUrl(response.url, options.allowedHosts);
      if (!response.ok && response.status !== 304) {
        if (isRetryableStatus(response.status) && attempt < options.retries) {
          await sleep(200 * 2 ** attempt);
          continue;
        }
        throw new HttpError(
          `HTTP ${response.status} while fetching ${url}`,
          "http",
          response.status,
        );
      }
      const body = response.status === 304 ? "" : await boundedRead(response, options.maxBytes);
      return {
        body,
        contentType: response.headers.get("content-type"),
        finalUrl: response.url,
        status: response.status,
        checksum: sha256(body),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    } catch (error) {
      lastError = error;
      if (error instanceof HttpError && error.category !== "network") throw error;
      if (attempt < options.retries) {
        await sleep(200 * 2 ** attempt);
        continue;
      }
    }
  }
  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new HttpError(`Timeout while fetching ${url}`, "timeout");
  }
  throw new HttpError(`Network error while fetching ${url}`, "network");
}

function validateUrl(rawUrl: string, allowedHosts: string[]) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:")
    throw new HttpError(`Only HTTPS URLs are allowed: ${rawUrl}`, "security");
  if (!allowedHosts.includes(url.hostname)) {
    throw new HttpError(`Host is not allow-listed: ${url.hostname}`, "security");
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

async function boundedRead(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new HttpError(`Response exceeded ${maxBytes} bytes`, "size");
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
