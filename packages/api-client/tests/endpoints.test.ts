import { describe, expect, it } from "vitest";

import {
  ENDPOINTS,
  createApiClient,
  createDirectoryApi,
  endpointPath,
  type ApiFetcher,
} from "../src/index.js";

const BASE_URL = "https://api.internal";

const META = {
  datasetReleaseId: "release-1",
  generatedAt: "2026-11-01T00:00:00.000Z",
  schemaVersion: "1.4.0",
};

function recordingApi() {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher: ApiFetcher = async (input, init) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
    return Response.json({ data: { ok: true }, meta: META });
  };
  const api = createDirectoryApi(createApiClient({ fetch: fetcher, baseUrl: BASE_URL }));
  return { api, calls };
}

describe("endpoint table", () => {
  it("declares every endpoint the site reads, as GET", () => {
    expect(Object.keys(ENDPOINTS).sort()).toEqual([
      "country",
      "index",
      "parties",
      "party",
      "partyObservations",
      "resolve",
      "sources",
      "stats",
    ]);
    for (const endpoint of Object.values(ENDPOINTS)) expect(endpoint.method).toBe("GET");
  });

  it("fills path templates with encoded segments", () => {
    expect(endpointPath(ENDPOINTS.party, { countryCode: "FR", partyId: "A/B C" })).toBe(
      "/api/v1/parties/FR/A%2FB%20C",
    );
  });

  it("refuses a template variable without a value", () => {
    expect(() => endpointPath(ENDPOINTS.party, { countryCode: "FR" })).toThrow(/partyId/);
  });
});

describe("directory api", () => {
  it("calls one URL per endpoint", async () => {
    const { api, calls } = recordingApi();

    await api.index();
    await api.stats();
    await api.sources();
    await api.country("fr");
    await api.parties();
    await api.party("FR", "ABC");
    await api.partyObservations("FR", "ABC");
    await api.resolve("FR*ABC");

    expect(calls.map((call) => call.url)).toEqual([
      `${BASE_URL}/api/v1`,
      `${BASE_URL}/api/v1/stats`,
      `${BASE_URL}/api/v1/sources`,
      `${BASE_URL}/api/v1/countries/fr`,
      `${BASE_URL}/api/v1/parties`,
      `${BASE_URL}/api/v1/parties/FR/ABC`,
      `${BASE_URL}/api/v1/parties/FR/ABC/observations`,
      `${BASE_URL}/api/v1/resolve/FR*ABC`,
    ]);
  });

  it("encodes every path segment", async () => {
    const { api, calls } = recordingApi();

    await api.country("F/R");
    await api.partyObservations("F R", "A?B");
    await api.resolve("FR#ABC");

    expect(calls.map((call) => call.url)).toEqual([
      `${BASE_URL}/api/v1/countries/F%2FR`,
      `${BASE_URL}/api/v1/parties/F%20R/A%3FB/observations`,
      `${BASE_URL}/api/v1/resolve/FR%23ABC`,
    ]);
  });

  it("sends the party filters the site uses, sorted, and drops the undefined ones", async () => {
    const { api, calls } = recordingApi();

    await api.parties({
      status: "ACTIVE",
      country: "FR",
      role: "CPO",
      q: "total energies",
      limit: 25,
      cursor: "abc",
      emobilityId: undefined,
    });
    await api.parties({ emobilityId: "FRABC", limit: 25 });

    expect(calls.map((call) => call.url)).toEqual([
      `${BASE_URL}/api/v1/parties?country=FR&cursor=abc&limit=25&q=total+energies&role=CPO&status=ACTIVE`,
      `${BASE_URL}/api/v1/parties?emobilityId=FRABC&limit=25`,
    ]);
  });

  it("never sends a query parameter the endpoint table does not list", async () => {
    const { api, calls } = recordingApi();

    // A caller bypassing the types must not reach the API with an undeclared parameter.
    await api.parties({ country: "FR", sort: "partyId" } as never);

    expect(calls[0]?.url).toBe(`${BASE_URL}/api/v1/parties?country=FR`);
  });

  it("passes If-None-Match and the caller's signal through", async () => {
    const { api, calls } = recordingApi();
    const controller = new AbortController();
    controller.abort();

    await api.country("FR", { ifNoneMatch: 'W/"abc"' });
    await expect(api.country("FR", { signal: controller.signal })).rejects.toMatchObject({
      kind: "aborted",
    });

    expect(calls).toHaveLength(1);
    expect(new Headers(calls[0]?.init?.headers).get("If-None-Match")).toBe('W/"abc"');
  });

  it("returns the unwrapped data and meta", async () => {
    const { api } = recordingApi();

    const result = await api.stats();

    expect(result).toMatchObject({ notModified: false, data: { ok: true }, meta: META });
  });
});
