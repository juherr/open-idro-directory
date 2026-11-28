import { ApiError, createApiClient, type ApiFetcher } from "@open-idro-directory/api-client";
import { describe, expect, it } from "vitest";

describe("api client from the web app", () => {
  it("reads a dataset answer through an injected fetcher", async () => {
    const urls: string[] = [];
    const fetcher: ApiFetcher = async (input) => {
      urls.push(String(input));
      return Response.json(
        {
          data: { status: "ok" },
          meta: {
            datasetReleaseId: "release-1",
            generatedAt: "2026-11-01T00:00:00.000Z",
            schemaVersion: "1.4.0",
          },
        },
        { headers: { "X-Dataset-Release": "release-1" } },
      );
    };
    const client = createApiClient({ fetch: fetcher, baseUrl: "https://api.internal" });

    const result = await client.request<{ status: string }>("/api/v1/health");

    expect(urls).toEqual(["https://api.internal/api/v1/health"]);
    expect(result.notModified).toBe(false);
    if (!result.notModified) expect(result.data.status).toBe("ok");
    expect(result.headers.datasetRelease).toBe("release-1");
  });

  it("surfaces the proxy's 502 as an http ApiError", async () => {
    const fetcher: ApiFetcher = async () =>
      Response.json(
        { error: { code: "API_UNAVAILABLE", message: "Unavailable.", requestId: "req-1" } },
        { status: 502 },
      );
    const client = createApiClient({ fetch: fetcher, baseUrl: "https://api.internal" });

    await expect(client.request("/api/v1/stats")).rejects.toMatchObject({
      kind: "http",
      status: 502,
      envelope: { code: "API_UNAVAILABLE" },
    });
    await expect(client.request("/api/v1/stats")).rejects.toBeInstanceOf(ApiError);
  });
});
