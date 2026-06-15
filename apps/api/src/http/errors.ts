import type { Context } from "hono";

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 422 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(c: Context, error: ApiError, requestId: string) {
  return c.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId,
      },
    },
    error.status,
  );
}
