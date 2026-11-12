import type { TaskModule } from "@nando/core";
import { Hono } from "hono";

import { bearerAuth } from "@api/http/middleware/auth";
import type { ApiDeps, ApiEnv } from "@api/http/types";
import { createCancelTaskRoute } from "./operations/cancel-task/route";
import { createCompleteTaskRoute } from "./operations/complete-task/route";
import { createCreateTaskRoute } from "./operations/create-task/route";
import { createGetTaskRoute } from "./operations/get-task/route";
import { createListTasksRoute } from "./operations/list-tasks/route";
import { createSkipTaskRoute } from "./operations/skip-task/route";
import { createUpdateTaskRoute } from "./operations/update-task/route";

/**
 * Composizione del route group `tasks`.
 *
 * L'autenticazione è applicata una volta sul prefisso; le route sono
 * concatenate per conservare il tipo di ogni endpoint in `hc<AppType>`.
 */
export function createTaskRoutes(deps: ApiDeps, tasks: TaskModule) {
  const auth = bearerAuth(deps.config.INTERNAL_TOKEN, deps.config.OWNER_USER_ID);

  return new Hono<ApiEnv>()
    .use("/api/tasks", auth)
    .use("/api/tasks/*", auth)
    .route("/", createListTasksRoute(tasks))
    .route("/", createGetTaskRoute(tasks))
    .route("/", createCreateTaskRoute(deps, tasks))
    .route("/", createUpdateTaskRoute(deps, tasks))
    .route("/", createCompleteTaskRoute(deps, tasks))
    .route("/", createSkipTaskRoute(deps, tasks))
    .route("/", createCancelTaskRoute(deps, tasks));
}
