/**
 * Same-origin proxy from the website Worker to the API Worker.
 *
 * On `workers.dev` previews and in local development the website owns every
 * path, so the API paths are forwarded through the `API` service binding to
 * keep same-origin browser fetches working. The proxy is transparent: the API
 * response, conditional and redirect statuses included, is returned as is.
 */

/** Error codes the website itself answers with, in the API's error envelope. */
type ProxyErrorCode = "API_UNAVAILABLE" | "ROUTE_NOT_FOUND";

/**
 * Whether the path belongs to the API Worker. Mirrors `isWorkerRoute` in
 * `apps/api/src/index.ts`, minus the country pages the website renders.
 */
export function isApiProxyPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname === "/docs" || pathname === "/openapi.json";
}

/**
 * Forwards the request to the API unchanged and returns the API response
 * unchanged. Redirects are passed back to the client, never followed. A
 * binding failure is answered with an uncacheable 502.
 */
export async function proxyToApi(request: Request, api: Fetcher): Promise<Response> {
  try {
    return await api.fetch(new Request(request, { redirect: "manual" }));
  } catch (error) {
    console.error("API service binding failed", { url: request.url, error });
    return errorResponse(502, "API_UNAVAILABLE", "The API is unavailable.");
  }
}

/**
 * Entry point of the proxy routes. Their patterns also match a few paths the
 * API does not serve (`/api`, `/docs/`), which get an uncacheable 404.
 */
export async function handleApiProxyRoute(request: Request, api: Fetcher): Promise<Response> {
  if (!isApiProxyPath(new URL(request.url).pathname)) {
    return errorResponse(404, "ROUTE_NOT_FOUND", "Route not found.");
  }
  return proxyToApi(request, api);
}

/** An error produced by the website: never cached, no validator. */
function errorResponse(status: 404 | 502, code: ProxyErrorCode, message: string): Response {
  const requestId = crypto.randomUUID();
  return Response.json(
    { error: { code, message, requestId } },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    },
  );
}
