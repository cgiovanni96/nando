import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { toApiError } from "@web/lib/api-error";
import { browserApiClient } from "@web/lib/browser-api-client";
import type { AgendaItem } from "@web/lib/queries/agenda";

type AgendaResponse = InferResponseType<typeof browserApiClient.api.agenda.$get, 200>;

async function fetchCalendarPage({
  from,
  to,
  cursor,
}: {
  from: string;
  to: string;
  cursor?: string;
}): Promise<AgendaResponse["data"]> {
  const response = await browserApiClient.api.agenda.$get({
    query: {
      from,
      to,
      includeOverdue: "false",
      includeClosed: "true",
      limit: "100",
      ...(cursor === undefined ? {} : { cursor }),
    },
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile caricare il calendario.");
  }

  return ((await response.json()) as AgendaResponse).data;
}

/**
 * Occorrenze dell'intervallo per il calendario: anche le chiuse arrivano
 * (`includeClosed=true`), le scadute fuori intervallo no, e le pagine si
 * concatenano seguendo `nextCursor`.
 */
export async function fetchCalendar({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<AgendaItem[]> {
  const items: AgendaItem[] = [];
  let cursor: string | undefined;

  for (;;) {
    const query = cursor === undefined ? { from, to } : { from, to, cursor };
    const page = await fetchCalendarPage(query);

    items.push(...page.items);

    if (page.nextCursor === null) {
      return items;
    }

    cursor = page.nextCursor;
  }
}

/**
 * La chiave parte da `["tasks"]` come l'agenda: le mutazioni dei task
 * invalidano `["tasks"]` e devono rinfrescare anche il calendario.
 */
export function calendarQueryOptions({ from, to }: { from: string; to: string }) {
  return queryOptions({
    queryKey: ["tasks", "agenda", "calendar", from, to] as const,
    queryFn: () => fetchCalendar({ from, to }),
    staleTime: 30_000,
  });
}
