import type { DomainError, Result } from "@nando/kernel";

import type { ContentfulStatusCode } from "hono/utils/http-status";

import { IdempotencyInProgressError, IdempotencyKeyReuseError } from "@nando/platform";

// Errori del confine HTTP.
//
// I moduli di dominio restituiscono `Result`: qui vive l'unico mapping
// `DomainError -> HttpError` e la traduzione degli errori di idempotenza in
// 409. Gli errori imprevisti diventano `internal_error` senza esporre dettagli.

/**
 * Errore già pronto per l'envelope HTTP.
 *
 * `code` è stabile e in inglese; il messaggio è italiano e sicuro da mostrare.
 * `retryable` è un suggerimento per il client, non un comportamento del server.
 */
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

/**
 * Traduce i codici di dominio nei codici wire di ADR-0022.
 *
 * Un codice sconosciuto non deve trapelare: diventa `internal_error`, così un
 * errore nuovo non inventa uno status o un codice che il client non conosce.
 */
export function domainErrorToHttp(error: DomainError): HttpError {
  switch (error.code) {
    case "validation_error":
      return new HttpError(400, error.code, error.message, error.details);
    case "not_found":
      return new HttpError(404, error.code, error.message, error.details);
    case "domain_rule_violation":
      return new HttpError(422, error.code, error.message, error.details);
    case "version_conflict":
      return new HttpError(409, error.code, error.message, error.details);
    default:
      return new HttpError(500, "internal_error", "Errore interno.");
  }
}

/**
 * Apre un `Result` per l'handler HTTP: restituisce il valore se è `ok`,
 * altrimenti lancia l'`HttpError` corrispondente.
 *
 * L'eccezione viene intercettata da `app.onError`, che la trasforma
 * nell'envelope con il `requestId` della richiesta.
 */
export function unwrapResult<T>(result: Result<T>): T {
  if (!result.ok) {
    throw domainErrorToHttp(result.error);
  }

  return result.value;
}

/**
 * Normalizza qualsiasi errore in `HttpError` per il gestore centrale.
 *
 * I conflitti di idempotenza hanno un codice dedicato; tutto il resto che non
 * è già un `HttpError` diventa `internal_error`. Il logging degli errori 5xx
 * resta responsabilità di `createApiApp`, non di questa funzione.
 */
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
