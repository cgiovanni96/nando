import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { browserApiClient } from "@web/lib/browser-api-client";

type TaskListResponse = InferResponseType<typeof browserApiClient.api.tasks.$get, 200>;

export type TaskItem = TaskListResponse["data"]["items"][number];

async function fetchDeletedTasks(): Promise<TaskItem[]> {
  const response = await browserApiClient.api.tasks.$get({
    query: { state: "deleted", limit: "50" },
  });

  if (!response.ok) {
    throw new Error("tasks_unavailable");
  }

  const body = (await response.json()) as TaskListResponse;

  return body.data.items;
}

/**
 * Task cancellati ancora dentro la finestra di grazia: `deletedAt` e
 * `restorableUntil` arrivano dal server, il client non ricalcola la scadenza.
 */
export const deletedTasksQueryOptions = queryOptions({
  queryKey: ["tasks", "deleted"] as const,
  queryFn: fetchDeletedTasks,
  staleTime: 30_000,
});
