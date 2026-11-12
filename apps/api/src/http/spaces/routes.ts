import type { SpaceModule } from "@nando/core";
import { Hono } from "hono";

import { bearerAuth } from "../middleware/auth";
import type { ApiDeps, ApiEnv } from "../types";
import { registerArchiveSpaceRoute } from "./operations/archive-space/route";
import { registerCreateSpaceRoute } from "./operations/create-space/route";
import { registerGetSpaceRoute } from "./operations/get-space/route";
import { registerListSpacesRoute } from "./operations/list-spaces/route";
import { registerRenameSpaceRoute } from "./operations/rename-space/route";
import { registerUnarchiveSpaceRoute } from "./operations/unarchive-space/route";

/**
 * Composizione del route group `spaces`.
 *
 * L'autenticazione è applicata una volta sul prefisso, così nessuna operazione
 * può dimenticarla. I registrar restano espliciti per non perdere l'inferenza
 * di `hc<AppType>`.
 */
export function createSpaceRoutes(deps: ApiDeps, spaces: SpaceModule) {
  const routes = new Hono<ApiEnv>();
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  routes.use("/api/spaces", auth);
  routes.use("/api/spaces/*", auth);

  registerListSpacesRoute(routes, spaces);
  registerGetSpaceRoute(routes, spaces);
  registerCreateSpaceRoute(routes, deps, spaces);
  registerRenameSpaceRoute(routes, deps, spaces);
  registerArchiveSpaceRoute(routes, deps, spaces);
  registerUnarchiveSpaceRoute(routes, deps, spaces);

  return routes;
}
