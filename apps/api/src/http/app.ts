import { Scalar } from "@scalar/hono-api-reference";
import { newId } from "@nando/kernel";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

import { errorEnvelope } from "./envelope";
import { HttpError, toHttpError } from "./errors";
import { createHealthRoutes } from "./health";
import { requestId } from "./middleware/request-id";
import { openApiOptions } from "./openapi";
import { createSystemRoutes } from "./system/routes";
import type { ApiDeps, ApiEnv } from "./types";

export type { ApiDeps } from "./types";

export function createContractApp(deps: ApiDeps) {
  const app = new Hono<ApiEnv>();
  app.route("/", createSystemRoutes(deps));
  return app;
}

export function createApiApp(deps: ApiDeps) {
  const app = new Hono<ApiEnv>();

  app.use("*", requestId);

  app.onError((error, c) => {
    const httpError = toHttpError(error);

    if (httpError.status >= 500) {
      console.error(error);
    }

    return c.json(errorEnvelope(httpError, c.get("requestId") ?? newId()), httpError.status);
  });

  app.notFound((c) =>
    c.json(
      errorEnvelope(
        new HttpError(404, "not_found", "Risorsa non trovata."),
        c.get("requestId") ?? newId(),
      ),
      404,
    ),
  );

  app.route("/", createHealthRoutes(deps));
  app.route("/", createContractApp(deps));

  if (deps.config.DOCS_ENABLED) {
    app.get("/api/openapi.json", openAPIRouteHandler(createContractApp(deps), openApiOptions));
    app.get(
      "/api/reference",
      Scalar({
        url: "/api/openapi.json",
        pageTitle: "Nando API",
      }),
    );
  }

  return app;
}
