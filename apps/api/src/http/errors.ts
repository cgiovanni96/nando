import type { ContentfulStatusCode } from "hono/utils/http-status";

import { IdempotencyInProgressError, IdempotencyKeyReuseError } from "@nando/platform";

export class HttpError extends Error {
  override name = "HttpError";

  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  if (error instanceof IdempotencyKeyReuseError) {
    return new HttpError(409, "idempotency_key_reuse", error.message);
  }

  if (error instanceof IdempotencyInProgressError) {
    return new HttpError(409, "conflict", error.message, undefined, true);
  }

  return new HttpError(500, "internal_error", "Errore interno.");
}
