import type { GenerateSpecOptions } from "hono-openapi";
import { resolver } from "hono-openapi";

import { errorEnvelopeSchema, type ErrorEnvelope } from "./envelope";

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
    ],
  },
  defaultValidationErrorResponse: false,
} satisfies Partial<GenerateSpecOptions>;

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
