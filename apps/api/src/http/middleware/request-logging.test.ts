import type { LogFields, Logger } from "@nando/platform";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { ApiEnv } from "@api/http/types";
import { requestLogging } from "@api/http/middleware/request-logging";

type LogEntry = { level: string; fields: LogFields; message: string };

function createFakeLogger(entries: LogEntry[], bindings: LogFields = {}): Logger {
  const log =
    (level: string) =>
    (fields: LogFields, message: string): void => {
      entries.push({ level, fields: { ...bindings, ...fields }, message });
    };

  return {
    fatal: log("fatal"),
    error: log("error"),
    warn: log("warn"),
    info: log("info"),
    debug: log("debug"),
    child: (childBindings) => createFakeLogger(entries, { ...bindings, ...childBindings }),
  };
}

function createApp(logger: Logger) {
  const app = new Hono<ApiEnv>();

  app.use("*", async (c, next) => {
    c.set("requestId", "req-1");
    await next();
  });
  app.use("*", requestLogging(logger));

  app.get("/api/tasks", (c) => c.json({ ok: true }));
  app.get("/api/bad", (c) => c.json({ error: "bad" }, 400));
  app.get("/api/boom", () => {
    throw new Error("boom");
  });
  app.onError((_error, c) => c.json({ error: "unhandled" }, 500));

  return app;
}

describe("requestLogging", () => {
  it("logs a 2xx with request id, method, path, status and duration", async () => {
    const entries: LogEntry[] = [];

    await createApp(createFakeLogger(entries)).request("/api/tasks");

    const entry = entries[0];
    if (!entry) throw new Error("expected a log entry");

    expect(entry).toMatchObject({
      level: "info",
      message: "request completed",
      fields: {
        requestId: "req-1",
        method: "GET",
        path: "/api/tasks",
        status: 200,
      },
    });
    expect(entry.fields.durationMs).toEqual(expect.any(Number));
  });

  it("logs a 4xx as a warning", async () => {
    const entries: LogEntry[] = [];

    await createApp(createFakeLogger(entries)).request("/api/bad");

    const entry = entries[0];
    if (!entry) throw new Error("expected a log entry");

    expect(entry.level).toBe("warn");
    expect(entry.fields.status).toBe(400);
  });

  it("logs a thrown handler as a 5xx error", async () => {
    const entries: LogEntry[] = [];

    await createApp(createFakeLogger(entries)).request("/api/boom");

    const entry = entries[0];
    if (!entry) throw new Error("expected a log entry");

    expect(entry.level).toBe("error");
    expect(entry.fields.status).toBe(500);
  });

  it("stays quiet on health checks", async () => {
    const entries: LogEntry[] = [];

    await createApp(createFakeLogger(entries)).request("/api/health");

    expect(entries).toHaveLength(0);
  });
});
