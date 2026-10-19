import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBinary,
  getText,
  type HttpClientOptions,
  postText,
} from "../../src/infrastructure/http/http-client.js";

const URL = "https://example.test/register";
const OPTIONS: HttpClientOptions = {
  timeoutMs: 1_000,
  retries: 0,
  maxBytes: 1_000,
  allowedHosts: ["example.test"],
  userAgent: "test",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HTTP client network errors", () => {
  // Node's fetch rejects with a bare "fetch failed" and keeps the reason in
  // `cause`: an expired certificate read as an unexplained network error.
  it.each([
    ["getText", () => getText(URL, OPTIONS)],
    ["getBinary", () => getBinary(URL, OPTIONS)],
  ])("%s reports the cause of a failed request", async (_, request) => {
    stubFetchFailure(certificateExpired());

    await expect(request()).rejects.toThrow(
      `Network error while fetching ${URL} (CERT_HAS_EXPIRED: certificate has expired)`,
    );
  });

  it("postText reports the cause of a failed request", async () => {
    stubFetchFailure(certificateExpired());

    await expect(postText(URL, "body", OPTIONS)).rejects.toThrow(
      `Network error while posting to ${URL} (CERT_HAS_EXPIRED: certificate has expired)`,
    );
  });

  it("reports a failure without a cause by its own message", async () => {
    stubFetchFailure(new TypeError("fetch failed"));

    await expect(getText(URL, OPTIONS)).rejects.toThrow(
      `Network error while fetching ${URL} (fetch failed)`,
    );
  });
});

function certificateExpired() {
  return new TypeError("fetch failed", {
    cause: Object.assign(new Error("certificate has expired"), { code: "CERT_HAS_EXPIRED" }),
  });
}

function stubFetchFailure(error: Error) {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}
