import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { toApiError } from "@web/lib/api-error";
import { browserApiClient } from "@web/lib/browser-api-client";

type AgendaResponse = InferResponseType<typeof browserApiClient.api.agenda.$get, 200>;

export type AgendaItem = AgendaResponse["data"]["items"][number];

async function fetchAgendaPage({
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
      includeOverdue: "true",
      limit: "100",
      ...(cursor === undefined ? {} : { cursor }),
    },
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile caricare l'agenda.");
  }

  return ((await response.json()) as AgendaResponse).data;
}

/**
 * Agenda dell'intervallo: le occorrenze scadute arrivano sempre
 * (`includeOverdue=true`) e le pagine si concatenano seguendo `nextCursor`.
 */
export async function fetchAgenda({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<AgendaItem[]> {
  const items: AgendaItem[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await fetchAgendaPage(cursor === undefined ? { from, to } : { from, to, cursor });

    items.push(...page.items);

    if (page.nextCursor === null) {
      return items;
    }

    cursor = page.nextCursor;
  }
}

/**
 * La chiave parte da `["tasks"]` di proposito: le mutazioni dei task
 * invalidano `["tasks"]` e devono rinfrescare anche l'agenda.
 */
export function agendaQueryOptions({ from, to }: { from: string; to: string }) {
  return queryOptions({
    queryKey: ["tasks", "agenda", from, to] as const,
    queryFn: () => fetchAgenda({ from, to }),
    staleTime: 30_000,
  });
}
