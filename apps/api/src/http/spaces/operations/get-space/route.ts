import type { SpaceModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { HttpError } from "@api/http/errors";
import { jsonResponse } from "@api/http/openapi";
import { notFoundResponse, queryErrorResponses, validateParam } from "@api/http/route-support";
import type { ApiEnv } from "@api/http/types";
import { spaceIdParamsSchema, spaceResponseSchema } from "@api/http/spaces/contract/shared";
import { toSpaceDto } from "@api/http/spaces/mapper";
import { childSpaceResponseExample } from "./contract";

const path = "/api/spaces/:spaceId";

export function createGetSpaceRoute(spaces: SpaceModule) {
  return new Hono<ApiEnv>().get(
    path,
    describeRoute({
      tags: ["spaces"],
      summary: "Legge uno Space",
      description:
        "Query senza effetti: restituisce uno Space non cancellato, anche se archiviato. " +
        "Risponde 404 `not_found` se lo Space non esiste o è stato cancellato.",
      responses: {
        200: jsonResponse("Space trovato.", spaceResponseSchema, childSpaceResponseExample),
        ...queryErrorResponses,
        404: notFoundResponse("Space assente o cancellato."),
      },
    }),
    validateParam(path, spaceIdParamsSchema),
    async (c) => {
      const { spaceId } = c.req.valid("param");
      const space = await spaces.queries.get(spaceId);

      if (!space) {
        throw new HttpError(404, "not_found", "Space non trovato.");
      }

      return c.json(spaceResponseSchema.parse({ ok: true, data: toSpaceDto(space) }), 200);
    },
  );
}
