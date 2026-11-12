import type { SpaceModule } from "@nando/core";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { jsonResponse } from "../../../openapi";
import { queryErrorResponses, validateQuery } from "../../../route-support";
import type { ApiEnv } from "../../../types";
import { toSpaceDto } from "../../mapper";
import {
  listSpacesQuerySchema,
  spaceListResponseExample,
  spaceListResponseSchema,
} from "./contract";

const path = "/api/spaces";

export function createListSpacesRoute(spaces: SpaceModule) {
  return new Hono<ApiEnv>().get(
    path,
    describeRoute({
      tags: ["spaces"],
      summary: "Elenca gli Space",
      description:
        "Query senza effetti: restituisce gli Space non cancellati, ordinati dal più recente. " +
        "Gli Space archiviati sono esclusi per default; `includeArchived=true` li include. " +
        "La paginazione usa `cursor` e `limit` (default 50, massimo 100).",
      responses: {
        200: jsonResponse(
          "Elenco paginato degli Space.",
          spaceListResponseSchema,
          spaceListResponseExample,
        ),
        ...queryErrorResponses,
      },
    }),
    validateQuery(path, listSpacesQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const result = await spaces.queries.list({
        includeArchived: query.includeArchived === "true",
        cursor: query.cursor ?? null,
        limit: query.limit,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.parentId ? { parentId: query.parentId } : {}),
      });

      return c.json(
        spaceListResponseSchema.parse({
          ok: true,
          data: { items: result.items.map(toSpaceDto), nextCursor: result.nextCursor },
        }),
        200,
      );
    },
  );
}
