import type { ApiErrorEnvelope } from "@nando/api/type";

/**
 * Errore del confine HTTP: `code` è stabile, `message` è già italiano e sicuro
 * da mostrare. Il client usa `code` per i casi che richiedono un'azione
 * (versione in conflitto, finestra di grazia scaduta) e `message` per il resto.
 */
export class ApiError extends Error {
  override name = "ApiError";

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Legge l'envelope d'errore documentato. Un corpo non JSON o inatteso non
 * deve nascondere il messaggio di fallback.
 */
export async function toApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorEnvelope>;

    if (body.ok === false && body.error) {
      return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // Corpo assente o non JSON: si usa il fallback.
  }

  return new ApiError(response.status, "unknown", fallbackMessage);
}
