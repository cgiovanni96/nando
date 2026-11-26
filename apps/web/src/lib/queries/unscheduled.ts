import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { toApiError } from "@web/lib/api-error";
import { browserApiClient } from "@web/lib/browser-api-client";
import type { TaskItem } from "@web/lib/queries/tasks";

type TaskListResponse = InferResponseType<typeof browserApiClient.api.tasks.$get, 200>;

/** Stati attivi (ADR-0028): i chiusi non tornano mai nel pannello. */
const ACTIVE_STATUSES = ["open", "in_progress"] as const;

type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

async function fetchUnscheduledPage({
  status,
  cursor,
}: {
  status: ActiveStatus;
  cursor?: string;
}): Promise<TaskListResponse["data"]> {
  const response = await browserApiClient.api.tasks.$get({
    query: {
      status,
      scheduled: "false",
      limit: "100",
      ...(cursor === undefined ? {} : { cursor }),
    },
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile caricare i task senza data.");
  }

  return ((await response.json()) as TaskListResponse).data;
}

async function fetchUnscheduledByStatus(status: ActiveStatus): Promise<TaskItem[]> {
  const items: TaskItem[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await fetchUnscheduledPage(cursor === undefined ? { status } : { status, cursor });

    items.push(...page.items);

    if (page.nextCursor === null) {
      return items;
    }

    cursor = page.nextCursor;
  }
}

/** I più vecchi prima: il pannello li mostra nell'ordine in cui sono nati. */
function oldestFirst(a: TaskItem, b: TaskItem): number {
  if (a.createdAt === b.createdAt) {
    return a.id.localeCompare(b.id);
  }

  return a.createdAt.localeCompare(b.createdAt);
}

export async function fetchUnscheduled(): Promise<TaskItem[]> {
  const pages = await Promise.all(
    ACTIVE_STATUSES.map((status) => fetchUnscheduledByStatus(status)),
  );

  return pages.flat().toSorted(oldestFirst);
}

/** Task attivi senza Schedule: una query per stato attivo, poi un solo elenco. */
export const unscheduledQueryOptions = queryOptions({
  queryKey: ["tasks", "unscheduled"] as const,
  queryFn: fetchUnscheduled,
  staleTime: 30_000,
});
