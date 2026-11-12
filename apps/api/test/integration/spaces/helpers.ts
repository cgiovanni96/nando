import { newId } from "@nando/kernel";
import { createTestDatabase, parseApiConfig, TEST_OWNER_ID } from "@nando/platform";
import { expect } from "vitest";

import { createApiApp } from "@api/http/app";
import {
  createSpaceRequestFactory,
  spaceResponseSchema,
  type SpaceDto,
} from "@api/http/spaces/contract";

export const INTERNAL_TOKEN = "0123456789abcdef0123456789abcdef";

export const config = parseApiConfig({
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  OWNER_USER_ID: TEST_OWNER_ID,
  INTERNAL_TOKEN,
  DOCS_ENABLED: "true",
});

export const handle = createTestDatabase();
export const app = createApiApp({ config, db: handle.db });

export const authHeaders = {
  authorization: `Bearer ${INTERNAL_TOKEN}`,
};

export const jsonHeaders = {
  ...authHeaders,
  "content-type": "application/json",
};

export async function post(path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

export async function get(path: string): Promise<Response> {
  return app.request(path, { headers: authHeaders });
}

export async function createSpace(input: {
  name: string;
  kind: SpaceDto["kind"];
  parentId?: string | null;
}): Promise<SpaceDto> {
  const payload = createSpaceRequestFactory({
    commandId: newId(),
    name: input.name,
    kind: input.kind,
    parentId: input.parentId ?? null,
  });

  const response = await post("/api/spaces", payload);
  const parsed = spaceResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);

  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));
  return parsed.data.data;
}

export async function readSpace(spaceId: string): Promise<SpaceDto> {
  const response = await get(`/api/spaces/${spaceId}`);
  const parsed = spaceResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);

  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));
  return parsed.data.data;
}
