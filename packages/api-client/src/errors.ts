/**
 * What went wrong:
 * - `http`: the server answered a non-2xx status other than 304;
 * - `network`: the fetcher rejected (DNS, connection, service binding failure);
 * - `timeout`: the client's own deadline elapsed before the body was read;
 * - `aborted`: the caller's signal aborted the request;
 * - `invalid-json`: a 2xx answer whose body is not JSON.
 */
export type ApiErrorKind = "http" | "network" | "timeout" | "aborted" | "invalid-json";

/** The API error envelope body, `{ error: ApiErrorEnvelope }` (see `apps/api/src/http/errors.ts`). */
export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  /** A plain number: the web proxy and the edge answer statuses the API never emits (502). */
  status?: number | undefined;
  requestId?: string | undefined;
  envelope?: ApiErrorEnvelope | undefined;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  /** `X-Request-Id` when the answer carries it, else the envelope's `requestId`. */
  readonly requestId: string | undefined;
  readonly envelope: ApiErrorEnvelope | undefined;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.requestId = init.requestId;
    this.envelope = init.envelope;
  }
}

/** Reads the envelope out of a parsed body; `undefined` when the body is not one. */
export function parseErrorEnvelope(body: unknown): ApiErrorEnvelope | undefined {
  if (!isRecord(body) || !isRecord(body.error)) return undefined;
  const { code, message, details, requestId } = body.error;
  if (typeof code !== "string" || typeof message !== "string" || typeof requestId !== "string") {
    return undefined;
  }
  return details === undefined
    ? { code, message, requestId }
    : { code, message, details, requestId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
