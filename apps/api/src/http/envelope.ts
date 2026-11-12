import { z } from "zod";

// Envelope wire di ADR-0022: successo `{ ok: true, data }` ed errore
// `{ ok: false, error, requestId }`.
//
// Gli schemi sono condivisi da tutte le route; i DTO delle singole operazioni
// vivono nei contract dei gruppi.

/** Request id usato negli esempi e nelle fixture; non è un id reale. */
export const EXAMPLE_REQUEST_ID = "0199a4c2-7a10-7000-8000-000000000001";

/**
 * `commandId` client: UUIDv7, stabile tra i retry della stessa intenzione.
 * Il refine controlla il nibble di versione, non solo il formato UUID.
 */
export const uuidV7Schema = z.uuid().refine((value) => value[14] === "7", {
  message: "Deve essere un UUIDv7.",
});

/** Riferimento cross-module a un'entità: tipo più identificatore. */
export const entityRefSchema = z.object({
  type: z.string().min(1),
  id: z.uuid(),
});

/**
 * Envelope di successo per un dato schema.
 *
 * `meta.affected` è opzionale e non obbligatorio: i comandi lo usano solo
 * quando il client deve invalidare più entità.
 */
export const successEnvelopeSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    ok: z.literal(true),
    data,
    meta: z
      .object({
        affected: z.array(entityRefSchema).optional(),
      })
      .optional(),
  });

/** Envelope d'errore: `code` stabile, `message` italiano e sicuro da mostrare. */
export const errorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
    retryable: z.boolean().optional(),
  }),
  requestId: z.uuid(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export type ErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
};

/** Costruisce la forma di successo senza validarla: la usa il tipo `data`. */
export function successEnvelope<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

/**
 * Valida e costruisce l'envelope d'errore con il `requestId` della richiesta.
 * Il parse è voluto: un errore malformato non deve raggiungere il client.
 */
export function errorEnvelope(payload: ErrorPayload, requestId: string): ErrorEnvelope {
  return errorEnvelopeSchema.parse({
    ok: false,
    error: payload,
    requestId,
  });
}

/** Envelope d'errore deterministico per esempi e fixture. */
export function errorExample(payload: ErrorPayload): ErrorEnvelope {
  return errorEnvelope(payload, EXAMPLE_REQUEST_ID);
}
