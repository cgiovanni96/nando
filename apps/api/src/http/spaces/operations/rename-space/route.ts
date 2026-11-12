import type { SpaceModule } from "@nando/core";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "../../../errors";
import { jsonRequestBody, jsonResponse } from "../../../openapi";
import {
  type ApiRouter,
  commandErrorResponses,
  commandResponse,
  domainRuleViolationResponse,
  notFoundResponse,
  validateJson,
  validateParam,
} from "../../../route-support";
import type { ApiDeps } from "../../../types";
import { spaceIdParamsSchema, spaceResponseSchema } from "../../contract/shared";
import { toSpaceDto } from "../../mapper";
import {
  renameSpaceRequestExample,
  renameSpaceRequestSchema,
  renamedSpaceResponseExample,
} from "./contract";

const path = "/api/spaces/:spaceId/rename";

export function registerRenameSpaceRoute(router: ApiRouter, deps: ApiDeps, spaces: SpaceModule) {
  router.post(
    path,
    describeRoute({
      tags: ["spaces"],
      summary: "Rinomina uno Space",
      description:
        "Comando idempotente: cambia il nome di uno Space attivo e incrementa `version`. " +
        "Il `kind` non è modificabile. Uno Space archiviato è in sola lettura e restituisce " +
        "422 `domain_rule_violation`.",
      requestBody: jsonRequestBody(renameSpaceRequestSchema, renameSpaceRequestExample),
      responses: {
        200: jsonResponse(
          "Space rinominato o replay dello stesso comando.",
          spaceResponseSchema,
          renamedSpaceResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Space assente o cancellato."),
        422: domainRuleViolationResponse("Space archiviato."),
      },
    }),
    validateParam(path, spaceIdParamsSchema),
    validateJson(path, renameSpaceRequestSchema),
    async (c) => {
      const { spaceId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "space.rename",
        commandId: payload.commandId,
        payload: { spaceId, name: payload.name },
        responseSchema: spaceResponseSchema,
        execute: async () => {
          const result = await spaces.commands.rename({ spaceId, name: payload.name });
          const renamed = unwrapResult(result);

          return toSpaceDto(renamed);
        },
      });
    },
  );
}
