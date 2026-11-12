import type { SpaceModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "../../../errors";
import { jsonRequestBody, jsonResponse } from "../../../openapi";
import {
  commandErrorResponses,
  commandResponse,
  domainRuleViolationResponse,
  notFoundResponse,
  validateJson,
  validateParam,
} from "../../../route-support";
import type { ApiDeps, ApiEnv } from "../../../types";
import {
  spaceCommandRequestExample,
  spaceCommandRequestSchema,
  spaceIdParamsSchema,
  spaceResponseSchema,
} from "../../contract/shared";
import { toSpaceDto } from "../../mapper";
import { unarchivedSpaceResponseExample } from "./contract";

const path = "/api/spaces/:spaceId/unarchive";

export function createUnarchiveSpaceRoute(deps: ApiDeps, spaces: SpaceModule) {
  return new Hono<ApiEnv>().post(
    path,
    describeRoute({
      tags: ["spaces"],
      summary: "Riattiva uno Space archiviato",
      description:
        "Comando idempotente: toglie lo stato di archiviazione a uno Space e ai suoi discendenti. " +
        "Riattivare uno Space già attivo restituisce lo stesso risultato. Se un genitore è " +
        "ancora archiviato il comando restituisce 422 `domain_rule_violation`: si riattiva " +
        "prima la radice archiviata.",
      requestBody: jsonRequestBody(spaceCommandRequestSchema, spaceCommandRequestExample),
      responses: {
        200: jsonResponse(
          "Space riattivato o replay dello stesso comando.",
          spaceResponseSchema,
          unarchivedSpaceResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Space assente o cancellato."),
        422: domainRuleViolationResponse("Un genitore è ancora archiviato."),
      },
    }),
    validateParam(path, spaceIdParamsSchema),
    validateJson(path, spaceCommandRequestSchema),
    async (c) => {
      const { spaceId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "space.unarchive",
        commandId: payload.commandId,
        payload: { spaceId },
        responseSchema: spaceResponseSchema,
        execute: async (tx) => {
          const result = await spaces.commands.unarchive({ spaceId }, tx);
          const unarchived = unwrapResult(result);

          return toSpaceDto(unarchived);
        },
      });
    },
  );
}
