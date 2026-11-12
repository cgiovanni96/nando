import { newId } from "@nando/kernel";
import { createTestDatabase, parseApiConfig, seedOwner, TEST_OWNER_ID } from "@nando/platform";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApiApp } from "@api/http/app";
import { errorEnvelopeSchema } from "@api/http/envelope";
import { systemEchoResponseSchema, systemInfoResponseSchema } from "@api/http/system/contract";

const INTERNAL_TOKEN = "0123456789abcdef0123456789abcdef";

const config = parseApiConfig({
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  OWNER_USER_ID: TEST_OWNER_ID,
  INTERNAL_TOKEN,
  DOCS_ENABLED: "true",
});

const handle = createTestDatabase();
const app = createApiApp({ config, db: handle.db });

const authHeaders = {
  authorization: `Bearer ${INTERNAL_TOKEN}`,
};

beforeEach(async () => {
  await seedOwner(handle.db, TEST_OWNER_ID);
});

afterAll(async () => {
  await handle.close();
});

async function jsonBody(response: Response): Promise<unknown> {
  return response.json();
}

describe("system routes", () => {
  it("returns system info with the documented envelope", async () => {
    const response = await app.request("/api/system/info", { headers: authHeaders });
    const parsed = systemInfoResponseSchema.safeParse(await jsonBody(response));

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.name).toBe("nando");
      expect(parsed.data.data.environment).toBe("test");
      expect(parsed.data.data.docsEnabled).toBe(true);
    }
  });

  it("rejects a missing bearer with the error envelope", async () => {
    const response = await app.request("/api/system/info");
    const parsed = errorEnvelopeSchema.safeParse(await jsonBody(response));

    expect(response.status).toBe(401);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("unauthorized");
      expect(parsed.data.requestId).toBe(response.headers.get("x-request-id"));
    }
  });

  it("executes the echo command and replays the same result", async () => {
    const commandId = newId();
    const payload = { commandId, message: "Ciao da Nando" };
    const request = () =>
      app.request("/api/system/echo", {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

    const first = await request();
    const firstParsed = systemEchoResponseSchema.safeParse(await jsonBody(first));

    const replay = await request();
    const replayParsed = systemEchoResponseSchema.safeParse(await jsonBody(replay));

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(firstParsed.success).toBe(true);
    expect(replayParsed).toEqual(firstParsed);
  });

  it("rejects the same commandId with a different payload", async () => {
    const commandId = newId();

    await app.request("/api/system/echo", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ commandId, message: "Primo" }),
    });

    const response = await app.request("/api/system/echo", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ commandId, message: "Secondo" }),
    });
    const parsed = errorEnvelopeSchema.safeParse(await jsonBody(response));

    expect(response.status).toBe(409);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("idempotency_key_reuse");
    }
  });

  it("rejects an invalid command payload", async () => {
    const response = await app.request("/api/system/echo", {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/json" },
      body: JSON.stringify({ commandId: newId(), message: "" }),
    });
    const parsed = errorEnvelopeSchema.safeParse(await jsonBody(response));

    expect(response.status).toBe(400);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("validation_error");
    }
  });

  it("serves health without auth", async () => {
    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
  });

  it("does not serve docs when DOCS_ENABLED is false", async () => {
    const appWithoutDocs = createApiApp({
      config: { ...config, DOCS_ENABLED: false },
      db: handle.db,
    });

    const response = await appWithoutDocs.request("/api/openapi.json");
    expect(response.status).toBe(404);
  });

  it("serves the OpenAPI document and Scalar reference", async () => {
    const specResponse = await app.request("/api/openapi.json");
    const spec = (await specResponse.json()) as { openapi?: string };

    expect(specResponse.status).toBe(200);
    expect(spec.openapi).toBe("3.1.0");

    const referenceResponse = await app.request("/api/reference");
    expect(referenceResponse.status).toBe(200);
    expect(referenceResponse.headers.get("content-type")).toContain("text/html");
  });

  it("returns the error envelope for an unknown route", async () => {
    const response = await app.request("/api/unknown", { headers: authHeaders });
    const parsed = errorEnvelopeSchema.safeParse(await jsonBody(response));

    expect(response.status).toBe(404);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("not_found");
    }
  });
});
