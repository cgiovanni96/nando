import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { toApiError } from "@web/lib/api-error";
import { browserApiClient } from "@web/lib/browser-api-client";

type TaskListResponse = InferResponseType<typeof browserApiClient.api.tasks.$get, 200>;
type TaskDetailResponse = InferResponseType<
  (typeof browserApiClient.api.tasks)[":taskId"]["$get"],
  200
>;

export type TaskItem = TaskListResponse["data"]["items"][number];
export type TaskDetail = TaskDetailResponse["data"];

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
  queryKey: ["trash", "tasks"] as const,
  queryFn: fetchDeletedTasks,
  staleTime: 30_000,
});

async function fetchTask(taskId: string): Promise<TaskDetail> {
  const response = await browserApiClient.api.tasks[":taskId"].$get({ param: { taskId } });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile caricare il task.");
  }

  const body = (await response.json()) as TaskDetailResponse;

  return body.data;
}

/**
 * Dettaglio del task: dentro la finestra di grazia il server restituisce anche
 * i cancellati, con `deletedAt` e `restorableUntil`.
 */
export function taskQueryOptions(taskId: string) {
  return queryOptions({
    queryKey: ["tasks", "detail", taskId] as const,
    queryFn: () => fetchTask(taskId),
    staleTime: 30_000,
  });
}
