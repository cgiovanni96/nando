import type { GenerateSpecOptions } from "hono-openapi";
import { resolver } from "hono-openapi";
import type { z } from "zod";

import { errorEnvelopeSchema, errorExample, type ErrorEnvelope } from "./envelope";

/**
 * Opzioni e builder dell'OpenAPI generato da `hono-openapi`.
 *
 * `docs:check` usa queste stesse opzioni: la spec non è un file committato ma
 * un artefatto derivato dalle route e dai contract.
 */
export const openApiOptions = {
  documentation: {
    openapi: "3.1.0",
    info: {
      title: "Nando API",
      version: "0.0.0",
      description: "Contratto HTTP fra apps/web e apps/api. Non è la documentazione di prodotto.",
    },
    servers: [{ url: "/" }],
    tags: [
      {
        name: "system",
        description: "Sistema e route group di prova del contratto HTTP.",
      },
      {
        name: "spaces",
        description: "Space, PARA e il lifecycle di archivio.",
      },
      {
        name: "inbox",
        description: "Vista globale delle entità senza Space proprietario.",
      },
      {
        name: "tasks",
        description: "Task core: titolo, stato, scadenza e Space.",
      },
    ],
  },
  defaultValidationErrorResponse: false,
} satisfies Partial<GenerateSpecOptions>;

/**
 * Esempi degli errori wire.
 *
 * Le route li riusano nelle response documentate: un esempio scritto a mano
 * fuori da qui sarebbe una seconda copia destinata a divergere.
 */
export const errorExamples = {
  validation: errorExample({
    code: "validation_error",
    message: "Dati non validi.",
  }),
  unauthorized: errorExample({
    code: "unauthorized",
    message: "Token interno mancante o errato.",
  }),
  notFound: errorExample({
    code: "not_found",
    message: "Risorsa non trovata.",
  }),
  domainRuleViolation: errorExample({
    code: "domain_rule_violation",
    message: "Regola di dominio violata.",
  }),
  idempotencyKeyReuse: errorExample({
    code: "idempotency_key_reuse",
    message: "Lo stesso commandId è già stato usato con un payload diverso.",
  }),
  versionConflict: errorExample({
    code: "version_conflict",
    message: "La versione attesa non corrisponde a quella corrente.",
  }),
  internal: errorExample({
    code: "internal_error",
    message: "Errore interno.",
  }),
};

/** Response d'errore con lo schema condiviso dell'envelope. */
export function errorResponse(description: string, example: ErrorEnvelope) {
  return {
    description,
    content: {
      "application/json": {
        schema: resolver(errorEnvelopeSchema),
        example,
      },
    },
  };
}

/**
 * Response JSON documentata.
 *
 * L'esempio è tipato dallo schema: un cambio di schema che non aggiorna
 * l'esempio non compila.
 */
export function jsonResponse<T extends z.ZodType>(
  description: string,
  schema: T,
  example: z.infer<T>,
) {
  return {
    description,
    content: {
      "application/json": {
        schema: resolver(schema),
        example,
      },
    },
  };
}

/** Request body JSON obbligatorio, con lo stesso vincolo sull'esempio. */
export function jsonRequestBody<T extends z.ZodType>(schema: T, example: z.infer<T>) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: resolver(schema),
        example,
      },
    },
  };
}
