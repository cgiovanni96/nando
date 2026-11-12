import type { SpaceModule } from "@nando/core";
import { Hono } from "hono";

import { bearerAuth } from "@api/http/middleware/auth";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import { createArchiveSpaceRoute } from "./operations/archive-space/route";
import { createCreateSpaceRoute } from "./operations/create-space/route";
import { createGetSpaceRoute } from "./operations/get-space/route";
import { createListSpacesRoute } from "./operations/list-spaces/route";
import { createRenameSpaceRoute } from "./operations/rename-space/route";
import { createUnarchiveSpaceRoute } from "./operations/unarchive-space/route";

/**
 * Composizione del route group `spaces`.
 *
 * L'autenticazione è applicata una volta sul prefisso, così nessuna operazione
 * può dimenticarla. Le route sono concatenate per conservare il tipo di ogni
 * endpoint in `hc<AppType>`.
 */
export function createSpaceRoutes(deps: ApiDeps, spaces: SpaceModule) {
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  return new Hono<ApiEnv>()
    .use("/api/spaces", auth)
    .use("/api/spaces/*", auth)
    .route("/", createListSpacesRoute(spaces))
    .route("/", createGetSpaceRoute(spaces))
    .route("/", createCreateSpaceRoute(deps, spaces))
    .route("/", createRenameSpaceRoute(deps, spaces))
    .route("/", createArchiveSpaceRoute(deps, spaces))
    .route("/", createUnarchiveSpaceRoute(deps, spaces));
}
