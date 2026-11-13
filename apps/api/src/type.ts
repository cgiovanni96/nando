import type { createApiApp } from "./http/app";
import type { ErrorEnvelope } from "./http/envelope";

export type AppType = ReturnType<typeof createApiApp>;

/** Forma dell'errore wire: il web la legge per mostrare `message` e `code`. */
export type ApiErrorEnvelope = ErrorEnvelope;
