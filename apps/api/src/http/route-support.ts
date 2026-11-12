import { runIdempotentCommand } from "@nando/platform";
import type { Context } from "hono";
import type { Hono } from "hono";
import { validator } from "hono-openapi";
import type { z } from "zod";

import { errorEnvelope } from "./envelope";
import { errorExamples, errorResponse } from "./openapi";
import type { ApiDeps, ApiEnv } from "./types";

// Supporto condiviso dai route group: validazione delle request, esecuzione
// dei comandi idempotenti e response d'errore documentate.
//
// Le route importano questi helper invece di ripetere il callback di
// validazione e l'envelope: così il comportamento resta uno solo per tutti
// i gruppi e un cambio qui vale per l'intera API.

/** Router Hono con le variabili impostate da `requestId` e `bearerAuth`. */
export type ApiRouter = Hono<ApiEnv>;

/**
 * Risposta 400 per un validator fallito.
 *
 * `details` contiene l'errore Zod: il client può mostrare i campi invalidi
 * senza perdere il `requestId`, che resta nell'envelope.
 */
export function rejectValidation(c: Context<ApiEnv>, error: unknown) {
  return c.json(
    errorEnvelope(
      {
        code: "validation_error",
        message: "Dati non validi.",
        details: error,
      },
      c.get("requestId"),
    ),
    400,
  );
}

/**
 * Validator del body JSON con la risposta 400 condivisa.
 *
 * `path` resta un tipo literal: serve a `hono-openapi` e a `hc<AppType>` per
 * non perdere l'inferenza della route.
 */
export function validateJson<Path extends string, Schema extends z.ZodType>(
  path: Path,
  schema: Schema,
) {
  return validator<Schema, "json", ApiEnv, Path>("json", schema, (result, c) => {
    if (!result.success) return rejectValidation(c, result.error);
  });
}

/** Validator dei path param con la risposta 400 condivisa. */
export function validateParam<Path extends string, Schema extends z.ZodType>(
  path: Path,
  schema: Schema,
) {
  return validator<Schema, "param", ApiEnv, Path>("param", schema, (result, c) => {
    if (!result.success) return rejectValidation(c, result.error);
  });
}

/** Validator della query string con la risposta 400 condivisa. */
export function validateQuery<Path extends string, Schema extends z.ZodType>(
  path: Path,
  schema: Schema,
) {
  return validator<Schema, "query", ApiEnv, Path>("query", schema, (result, c) => {
    if (!result.success) return rejectValidation(c, result.error);
  });
}

/** Forma del successo già documentata dagli schemi del contract. */
type SuccessEnvelope<T> = { ok: true; data: T };

/**
 * Esegue un comando idempotente e restituisce l'envelope di successo.
 *
 * Nasconde le operazioni che ogni comando deve fare allo stesso modo:
 * - ricava `actorId` dal middleware di autenticazione;
 * - usa il database del composition root;
 * - passa a `runIdempotentCommand` il payload che identifica il replay;
 * - valida il risultato contro lo schema documentato e risponde 200.
 *
 * `execute` deve restituire solo il DTO: l'envelope viene costruita da questo
 * helper. Gli errori di dominio restano `Result` e vanno aperti con
 * `unwrapResult` dentro `execute`, così il mapping HTTP resta in `errors.ts`.
 */
export async function commandResponse<T>(
  c: Context<ApiEnv>,
  deps: ApiDeps,
  input: {
    commandName: string;
    commandId: string;
    payload: unknown;
    responseSchema: z.ZodType<SuccessEnvelope<T>>;
    execute: () => Promise<T>;
  },
): Promise<Response> {
  const response = await runIdempotentCommand({
    db: deps.db,
    actorId: c.get("actorId"),
    commandName: input.commandName,
    commandId: input.commandId,
    payload: input.payload,
    execute: async () => input.responseSchema.parse({ ok: true, data: await input.execute() }),
  });

  return c.json(response, 200);
}

/** Response d'errore comuni alle query: 400, 401 e 500. */
export const queryErrorResponses = {
  400: errorResponse("Query non valida.", errorExamples.validation),
  401: errorResponse("Bearer interno mancante o errato.", errorExamples.unauthorized),
  500: errorResponse("Errore imprevisto.", errorExamples.internal),
};

/** Response d'errore comuni ai comandi: aggiunge il 409 di idempotenza. */
export const commandErrorResponses = {
  400: errorResponse("Payload o identificativo non valido.", errorExamples.validation),
  401: errorResponse("Bearer interno mancante o errato.", errorExamples.unauthorized),
  409: errorResponse(
    "commandId già usato con un payload diverso.",
    errorExamples.idempotencyKeyReuse,
  ),
  500: errorResponse("Errore imprevisto.", errorExamples.internal),
};

/**
 * Response 404 con l'esempio condiviso.
 *
 * La descrizione resta specifica della route: il client deve sapere quale
 * risorsa manca, non solo che il codice è `not_found`.
 */
export function notFoundResponse(description: string) {
  return errorResponse(description, errorExamples.notFound);
}

/** Response 422 per un invariante di dominio violata o uno stato incompatibile. */
export function domainRuleViolationResponse(description: string) {
  return errorResponse(description, errorExamples.domainRuleViolation);
}
