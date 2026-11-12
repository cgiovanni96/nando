import type { SpaceModule } from "@nando/core";
import { describeRoute } from "hono-openapi";

import { unwrapResult } from "../../../errors";
import { jsonRequestBody, jsonResponse } from "../../../openapi";
import {
  type ApiRouter,
  commandErrorResponses,
  commandResponse,
  notFoundResponse,
  validateJson,
  validateParam,
} from "../../../route-support";
import type { ApiDeps } from "../../../types";
import {
  spaceCommandRequestExample,
  spaceCommandRequestSchema,
  spaceIdParamsSchema,
  spaceResponseSchema,
} from "../../contract/shared";
import { toSpaceDto } from "../../mapper";
import { archivedSpaceResponseExample } from "./contract";

const path = "/api/spaces/:spaceId/archive";

export function registerArchiveSpaceRoute(router: ApiRouter, deps: ApiDeps, spaces: SpaceModule) {
  router.post(
    path,
    describeRoute({
      tags: ["spaces"],
      summary: "Archivia uno Space",
      description:
        "Comando idempotente: archivia uno Space e i suoi discendenti. Lo Space resta " +
        "interrogabile ma esce dalle viste attive, diventa in sola lettura e non contribuisce " +
        "agli aggregati. Archiviare uno Space già archiviato restituisce lo stesso risultato.",
      requestBody: jsonRequestBody(spaceCommandRequestSchema, spaceCommandRequestExample),
      responses: {
        200: jsonResponse(
          "Space archiviato o replay dello stesso comando.",
          spaceResponseSchema,
          archivedSpaceResponseExample,
        ),
        ...commandErrorResponses,
        404: notFoundResponse("Space assente o cancellato."),
      },
    }),
    validateParam(path, spaceIdParamsSchema),
    validateJson(path, spaceCommandRequestSchema),
    async (c) => {
      const { spaceId } = c.req.valid("param");
      const payload = c.req.valid("json");

      return commandResponse(c, deps, {
        commandName: "space.archive",
        commandId: payload.commandId,
        payload: { spaceId },
        responseSchema: spaceResponseSchema,
        execute: async () => {
          const result = await spaces.commands.archive({ spaceId });
          const archived = unwrapResult(result);

          return toSpaceDto(archived);
        },
      });
    },
  );
}
