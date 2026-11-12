import { newId } from "@nando/kernel";
import { createTestDatabase, parseApiConfig, TEST_OWNER_ID } from "@nando/platform";
import { expect } from "vitest";

import { createApiApp } from "../../../src/http/app";
import {
  createSpaceRequestFactory,
  spaceCommandRequestFactory,
  spaceResponseSchema,
  type SpaceDto,
} from "../../../src/http/spaces/contract";
import {
  createTaskRequestFactory,
  taskResponseSchema,
  type TaskDto,
} from "../../../src/http/tasks/contract";

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

export async function createSpace(name = "Vita"): Promise<SpaceDto> {
  const response = await post(
    "/api/spaces",
    createSpaceRequestFactory({
      commandId: newId(),
      name,
      kind: "area",
      parentId: null,
    }),
  );
  const parsed = spaceResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);

  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));
  return parsed.data.data;
}

export async function archiveSpace(spaceId: string): Promise<void> {
  const response = await post(
    `/api/spaces/${spaceId}/archive`,
    spaceCommandRequestFactory({ commandId: newId() }),
  );

  expect(response.status).toBe(200);
}

export async function createTask(input: {
  title: string;
  spaceId?: string | null;
  dueAt?: string | null;
}): Promise<TaskDto> {
  const response = await post(
    "/api/tasks",
    createTaskRequestFactory({
      commandId: newId(),
      title: input.title,
      spaceId: input.spaceId ?? null,
      dueAt: input.dueAt ?? null,
    }),
  );
  const parsed = taskResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);

  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));
  return parsed.data.data;
}

export async function readTask(taskId: string): Promise<TaskDto> {
  const response = await get(`/api/tasks/${taskId}`);
  const parsed = taskResponseSchema.safeParse(await response.json());

  expect(response.status).toBe(200);
  expect(parsed.success).toBe(true);

  if (!parsed.success) throw new Error(JSON.stringify(parsed.error));
  return parsed.data.data;
}
