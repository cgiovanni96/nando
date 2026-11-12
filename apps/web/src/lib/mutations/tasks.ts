import { mutationOptions } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";

import { browserApiClient } from "@web/lib/browser-api-client";

/** Body del comando, derivato dal contract della route: nessuna seconda copia. */
export type CreateTaskInput = InferRequestType<typeof browserApiClient.api.tasks.$post>["json"];

export async function createTask(input: CreateTaskInput) {
  const response = await browserApiClient.api.tasks.$post({ json: input });

  if (!response.ok) {
    throw new Error("capture_failed");
  }

  return response.json();
}

export const createTaskMutationOptions = mutationOptions({
  mutationFn: createTask,
});
