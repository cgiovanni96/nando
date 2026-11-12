import type { SpaceModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "@api/http/errors";
import { jsonRequestBody, jsonResponse } from "@api/http/openapi";
import {
  commandErrorResponses,
  commandResponse,
  domainRuleViolationResponse,
  notFoundResponse,
  validateJson,
} from "@api/http/route-support";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import { spaceResponseExample, spaceResponseSchema } from "@api/http/spaces/contract/shared";
import { toSpaceDto } from "@api/http/spaces/mapper";
import { createSpaceRequestExample, createSpaceRequestSchema } from "./contract";

const path = "/api/spaces";

export function createCreateSpaceRoute(deps: ApiDeps, spaces: SpaceModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["spaces"],
      summary: "Crea uno Space",
      description:
        "Comando idempotente: crea uno Space con `kind` area, project o resource. " +
        "Il `kind` resta immutabile dopo la creazione. `parentId` è null per uno Space alla radice; " +
        "altrimenti deve rispettare la grammatica PARA — un'area contiene aree e progetti, " +
        "un progetto contiene risorse, una risorsa è foglia. " +
        "Replayare lo stesso `commandId` con lo stesso payload restituisce lo stesso Space; " +
        "lo stesso `commandId` con un payload diverso restituisce 409 `idempotency_key_reuse`.",
      requestBody: jsonRequestBody(createSpaceRequestSchema, createSpaceRequestExample),
      responses: {
        200: jsonResponse(
          "Space creato o replay dello stesso comando.",
          spaceResponseSchema,
          spaceResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Space genitore assente."),
        422: domainRuleViolationResponse(
          "Gerarchia PARA non rispettata o Space genitore archiviato.",
        ),
      },
    }),
    validateJson(path, createSpaceRequestSchema),
    async (c) => {
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "space.create",
        commandId: payload.commandId,
        payload: {
          name: payload.name,
          kind: payload.kind,
          parentId: payload.parentId,
        },
        responseSchema: spaceResponseSchema,
        execute: async (tx) => {
          const result = await spaces.commands.create(
            {
              name: payload.name,
              kind: payload.kind,
              parentId: payload.parentId,
            },
            tx,
          );
          const created = unwrapResult(result);

          return toSpaceDto(created);
        },
      });
    },
  );
}
