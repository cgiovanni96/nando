import { createSpaceModule, createTaskModule, type InboxSource } from "@nando/core";
import { newId, systemClock } from "@nando/kernel";
import { createLogger } from "@nando/platform";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

import { errorEnvelope } from "./envelope";
import { HttpError, toHttpError } from "./errors";
import { createHealthRoutes } from "./health";
import { createInboxRoutes } from "./inbox/routes";
import { requestId } from "./middleware/request-id";
import { requestLogging } from "./middleware/request-logging";
import { openApiOptions } from "./openapi";
import { createSpaceRoutes } from "./spaces/routes";
import { createSystemRoutes } from "./system/routes";
import { createTaskRoutes } from "./tasks/routes";
import type { ApiDeps, ApiEnv } from "./types";

// Composizione dell'app HTTP.
//
// `createContractApp` monta solo il contratto: non registra health, docs o il
// gestore degli errori. È la superficie che `docs:check` usa per generare lo
// spec senza avviare il server.
//
// `createApiApp` aggiunge l'infrastruttura del processo: request id, envelope
// d'errore, health e documentazione opzionale.

export type { ApiDeps } from "./types";

/**
 * Costruisce i moduli di dominio una volta e monta i route group.
 *
 * I moduli non toccano il database alla costruzione: ricevono solo le
 * dipendenze. Per questo `docs:check` può passare un database finto e limitarsi
 * a generare la spec.
 */
export function createContractApp(deps: ApiDeps) {
  // Le sorgenti dell'Inbox sono un array condiviso: il modulo Space lo legge a
  // ogni query, quindi il modulo Task può registrarsi dopo la sua costruzione.
  // Serve perché Task dipende da Space (porta) e Space dalla sorgente di Task.
  const inboxSources: InboxSource[] = [...(deps.inboxSources ?? [])];

  const spaces = createSpaceModule({
    db: deps.db,
    clock: systemClock,
    ids: newId,
    inboxSources,
  });
  const tasks = createTaskModule({
    db: deps.db,
    clock: systemClock,
    ids: newId,
    spacePort: {
      get: (spaceId) => spaces.queries.get(spaceId),
    },
  });

  inboxSources.push({
    listUnassigned: (query) => tasks.queries.listUnassigned(query),
  });

  return new Hono<ApiEnv>()
    .route("/", createSystemRoutes(deps))
    .route("/", createSpaceRoutes(deps, spaces))
    .route("/", createInboxRoutes(deps, spaces))
    .route("/", createTaskRoutes(deps, tasks));
}

/** App completa del processo api: richieste, errori, health, contratto e docs. */
export function createApiApp(deps: ApiDeps) {
  const logger =
    deps.logger ??
    createLogger({
      level: deps.config.NODE_ENV === "test" ? "silent" : deps.config.LOG_LEVEL,
      service: "api",
      pretty: deps.config.NODE_ENV === "development",
    });

  const base = new Hono<ApiEnv>();

  // Ogni risposta porta un requestId stabile: lo riusa se il proxy lo invia,
  // altrimenti ne genera uno nuovo.
  base.use("*", requestId);
  base.use("*", requestLogging(logger));

  base.onError((error, c) => {
    const httpError = toHttpError(error);

    // Gli errori 5xx si loggano qui una volta; gli errori imprevisti non
    // espongono stack o dettagli interni, solo code, message e requestId.
    if (httpError.status >= 500) {
      (c.get("logger") ?? logger).error(
        { err: error, requestId: c.get("requestId") },
        "unhandled error",
      );
    }

    return c.json(errorEnvelope(httpError, c.get("requestId") ?? newId()), httpError.status);
  });

  // Anche una route sconosciuta passa dallo stesso envelope: il client non
  // deve distinguere un 404 di routing da un 404 di dominio.
  base.notFound((c) =>
    c.json(
      errorEnvelope(
        new HttpError(404, "not_found", "Risorsa non trovata."),
        c.get("requestId") ?? newId(),
      ),
      404,
    ),
  );

  const app = base.route("/", createHealthRoutes(deps)).route("/", createContractApp(deps));

  // La documentazione è strumentazione di sviluppo: spenta per default in
  // produzione e, se accesa, resta dietro Access (ADR-0022).
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
