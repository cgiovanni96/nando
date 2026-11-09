import { z } from "zod";

export const EXAMPLE_REQUEST_ID = "0199a4c2-7a10-7000-8000-000000000001";

export const uuidV7Schema = z.uuid().refine((value) => value[14] === "7", {
  message: "Deve essere un UUIDv7.",
});

export const entityRefSchema = z.object({
  type: z.string().min(1),
  id: z.uuid(),
});

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

export function successEnvelope<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function errorEnvelope(payload: ErrorPayload, requestId: string): ErrorEnvelope {
  return errorEnvelopeSchema.parse({
    ok: false,
    error: payload,
    requestId,
  });
}

export function errorExample(payload: ErrorPayload): ErrorEnvelope {
  return errorEnvelope(payload, EXAMPLE_REQUEST_ID);
}
