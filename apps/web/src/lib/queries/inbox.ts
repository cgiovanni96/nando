import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { browserApiClient } from "@web/lib/browser-api-client";

type InboxResponse = InferResponseType<typeof browserApiClient.api.inbox.$get, 200>;

export type InboxItem = InboxResponse["data"]["items"][number];

async function fetchInbox(): Promise<InboxItem[]> {
  const response = await browserApiClient.api.inbox.$get({ query: { limit: "50" } });

  if (!response.ok) {
    throw new Error("inbox_unavailable");
  }

  const body = (await response.json()) as InboxResponse;

  return body.data.items;
}

/** Entità senza Space proprietario: la lista Inbox è una vista, non uno Space. */
export const inboxQueryOptions = queryOptions({
  queryKey: ["inbox"] as const,
  queryFn: fetchInbox,
  staleTime: 30_000,
});
