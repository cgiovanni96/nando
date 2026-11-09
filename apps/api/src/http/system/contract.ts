import { z } from "zod";

import { errorExample, successEnvelopeSchema, uuidV7Schema } from "../envelope";

export const API_VERSION = "0.0.0";

export const systemInfoDataSchema = z.object({
  name: z.literal("nando"),
  version: z.string().min(1),
  environment: z.enum(["development", "test", "production"]),
  docsEnabled: z.boolean(),
});

export const systemInfoResponseSchema = successEnvelopeSchema(systemInfoDataSchema);

export const systemInfoResponseExample = systemInfoResponseSchema.parse({
  ok: true,
  data: {
    name: "nando",
    version: API_VERSION,
    environment: "development",
    docsEnabled: true,
  },
});

export const systemEchoRequestSchema = z.object({
  commandId: uuidV7Schema,
  message: z.string().min(1).max(1000),
});

export const systemEchoDataSchema = z.object({
  commandId: uuidV7Schema,
  message: z.string().min(1),
});

export const systemEchoResponseSchema = successEnvelopeSchema(systemEchoDataSchema);

export const systemEchoRequestExample = systemEchoRequestSchema.parse({
  commandId: "0199a4c2-7a10-7000-8000-000000000001",
  message: "Ciao da Nando",
});

export const systemEchoResponseExample = systemEchoResponseSchema.parse({
  ok: true,
  data: {
    commandId: systemEchoRequestExample.commandId,
    message: systemEchoRequestExample.message,
  },
});

export const errorExamples = {
  validation: errorExample({
    code: "validation_error",
    message: "Dati non validi.",
  }),
  unauthorized: errorExample({
    code: "unauthorized",
    message: "Token interno mancante o errato.",
  }),
  idempotencyKeyReuse: errorExample({
    code: "idempotency_key_reuse",
    message: "Lo stesso commandId è già stato usato con un payload diverso.",
  }),
  internal: errorExample({
    code: "internal_error",
    message: "Errore interno.",
  }),
};
