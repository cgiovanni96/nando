import { createMiddleware } from "hono/factory";

import type { Logger } from "@nando/platform";

import type { ApiEnv } from "@api/http/types";

const HEALTH_PATH = "/api/health";

/**
 * Un log per richiesta, con il `requestId` già impostato da `requestId`.
 *
 * Gli healthcheck restano fuori: girano ogni pochi secondi e non aggiungono
 * segnale. Se un handler lancia, il middleware logga comunque il 500 mentre
 * `onError` registra lo stack una sola volta.
 */
export function requestLogging(logger: Logger) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    const requestLogger = logger.child({ requestId: c.get("requestId") });
    c.set("logger", requestLogger);

    const startedAt = performance.now();

    try {
      await next();
    } finally {
      if (c.req.path !== HEALTH_PATH) {
        const durationMs = Math.round(performance.now() - startedAt);
        const status = c.res?.status ?? 500;
        const fields = {
          method: c.req.method,
          path: c.req.path,
          status,
          durationMs,
        };

        if (status >= 500) requestLogger.error(fields, "request failed");
        else if (status >= 400) requestLogger.warn(fields, "request completed");
        else requestLogger.info(fields, "request completed");
      }
    }
  });
}
