import type { TaskModule } from "@nando/core";
import { Hono } from "hono";

import { bearerAuth } from "../middleware/auth";
import type { ApiDeps, ApiEnv } from "../types";
import { registerCancelTaskRoute } from "./operations/cancel-task/route";
import { registerCompleteTaskRoute } from "./operations/complete-task/route";
import { registerCreateTaskRoute } from "./operations/create-task/route";
import { registerGetTaskRoute } from "./operations/get-task/route";
import { registerListTasksRoute } from "./operations/list-tasks/route";
import { registerSkipTaskRoute } from "./operations/skip-task/route";
import { registerUpdateTaskRoute } from "./operations/update-task/route";

/**
 * Composizione del route group `tasks`.
 *
 * L'autenticazione è applicata una volta sul prefisso; i registrar restano
 * espliciti per non perdere l'inferenza di `hc<AppType>`.
 */
export function createTaskRoutes(deps: ApiDeps, tasks: TaskModule) {
  const routes = new Hono<ApiEnv>();
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  routes.use("/api/tasks", auth);
  routes.use("/api/tasks/*", auth);

  registerListTasksRoute(routes, tasks);
  registerGetTaskRoute(routes, tasks);
  registerCreateTaskRoute(routes, deps, tasks);
  registerUpdateTaskRoute(routes, deps, tasks);
  registerCompleteTaskRoute(routes, deps, tasks);
  registerSkipTaskRoute(routes, deps, tasks);
  registerCancelTaskRoute(routes, deps, tasks);

  return routes;
}
