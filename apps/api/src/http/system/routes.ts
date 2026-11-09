import { runIdempotentCommand } from "@nando/platform";
import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import { errorEnvelope } from "../envelope";
import { bearerAuth } from "../middleware/auth";
import { errorResponse } from "../openapi";
import type { ApiDeps, ApiEnv } from "../types";
import {
  API_VERSION,
  errorExamples,
  systemEchoRequestSchema,
  systemEchoResponseExample,
  systemEchoResponseSchema,
  systemInfoResponseExample,
  systemInfoResponseSchema,
} from "./contract";

export function createSystemRoutes(deps: ApiDeps) {
  const system = new Hono<ApiEnv>();
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  system.get(
    "/api/system/info",
    auth,
    describeRoute({
      tags: ["system"],
      summary: "Informazioni di sistema",
      description:
        "Query senza effetti: nome, versione, ambiente e stato della documentazione OpenAPI. " +
        "Richiede il bearer interno aggiunto dal proxy di web.",
      responses: {
        200: {
          description: "Informazioni di sistema.",
          content: {
            "application/json": {
              schema: resolver(systemInfoResponseSchema),
              example: systemInfoResponseExample,
            },
          },
        },
        401: errorResponse("Bearer interno mancante o errato.", errorExamples.unauthorized),
        500: errorResponse("Errore imprevisto.", errorExamples.internal),
      },
    }),
    (c) =>
      c.json(
        systemInfoResponseSchema.parse({
          ok: true,
          data: {
            name: "nando",
            version: API_VERSION,
            environment: deps.config.NODE_ENV,
            docsEnabled: deps.config.DOCS_ENABLED,
          },
        }),
        200,
      ),
  );

  system.post(
    "/api/system/echo",
    auth,
    describeRoute({
      tags: ["system"],
      summary: "Comando di prova idempotente",
      description:
        "Comando di prova del wire: valida il body, esegue con commandId e restituisce il messaggio. " +
        "Replayare lo stesso commandId con lo stesso payload restituisce lo stesso risultato; " +
        "lo stesso commandId con un payload diverso restituisce 409 idempotency_key_reuse.",
      responses: {
        200: {
          description: "Comando eseguito o replay dello stesso comando.",
          content: {
            "application/json": {
              schema: resolver(systemEchoResponseSchema),
              example: systemEchoResponseExample,
            },
          },
        },
        400: errorResponse("Payload non valido.", errorExamples.validation),
        401: errorResponse("Bearer interno mancante o errato.", errorExamples.unauthorized),
        409: errorResponse(
          "commandId già usato con un payload diverso.",
          errorExamples.idempotencyKeyReuse,
        ),
        500: errorResponse("Errore imprevisto.", errorExamples.internal),
      },
    }),
    validator<typeof systemEchoRequestSchema, "json", ApiEnv, "/api/system/echo">(
      "json",
      systemEchoRequestSchema,
      (result, c) => {
        if (!result.success) {
          return c.json(
            errorEnvelope(
              {
                code: "validation_error",
                message: "Dati non validi.",
                details: result.error,
              },
              c.get("requestId"),
            ),
            400,
          );
        }
      },
    ),
    async (c) => {
      const payload = c.req.valid("json");
      const response = await runIdempotentCommand({
        db: deps.db,
        actorId: c.get("actorId"),
        commandName: "system.echo",
        commandId: payload.commandId,
        payload: { message: payload.message },
        execute: async () =>
          systemEchoResponseSchema.parse({
            ok: true,
            data: {
              commandId: payload.commandId,
              message: payload.message,
            },
          }),
      });

      return c.json(response, 200);
    },
  );

  return system;
}
