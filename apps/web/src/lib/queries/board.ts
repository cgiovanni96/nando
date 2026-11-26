import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { toApiError } from "@web/lib/api-error";
import { browserApiClient } from "@web/lib/browser-api-client";

type BoardResponse = InferResponseType<typeof browserApiClient.api.board.$get, 200>;

export type BoardItem = BoardResponse["data"]["items"][number];

/** Colonne del board (ADR-0028): una richiesta per stato. */
export type BoardStatus = "open" | "in_progress" | "completed";

/** Orizzonte di scadenza del filtro: `all` non manda `horizon`. */
export type BoardHorizon = "all" | "7" | "15" | "30";

export type BoardFilter = {
  spaceId: string | null;
  horizon: BoardHorizon;
};

export const BOARD_COLUMNS: readonly BoardStatus[] = ["open", "in_progress", "completed"];

async function fetchBoardPage({
  status,
  spaceId,
  horizon,
  cursor,
}: {
  status: BoardStatus;
  spaceId: string | null;
  horizon: BoardHorizon;
  cursor?: string;
}): Promise<BoardResponse["data"]> {
  const response = await browserApiClient.api.board.$get({
    query: {
      status,
      limit: "100",
      ...(spaceId === null ? {} : { spaceId }),
      ...(horizon === "all" ? {} : { horizon }),
      ...(cursor === undefined ? {} : { cursor }),
    },
  });

  if (!response.ok) {
    throw await toApiError(response, "Non è stato possibile caricare i task.");
  }

  return ((await response.json()) as BoardResponse).data;
}

/** Una colonna: le pagine si concatenano seguendo `nextCursor`, in ordine del server. */
async function fetchBoardColumn(status: BoardStatus, filter: BoardFilter): Promise<BoardItem[]> {
  const items: BoardItem[] = [];
  let cursor: string | undefined;

  for (;;) {
    const page = await fetchBoardPage(
      cursor === undefined
        ? { status, spaceId: filter.spaceId, horizon: filter.horizon }
        : { status, spaceId: filter.spaceId, horizon: filter.horizon, cursor },
    );

    items.push(...page.items);

    if (page.nextCursor === null) {
      return items;
    }

    cursor = page.nextCursor;
  }
}

/**
 * La chiave parte da `["tasks"]` di proposito: le mutazioni dei task
 * invalidano `["tasks"]` e devono rinfrescare anche il board.
 */
export function boardColumnQueryOptions(status: BoardStatus, filter: BoardFilter) {
  return queryOptions({
    queryKey: ["tasks", "board", status, filter.spaceId, filter.horizon] as const,
    queryFn: () => fetchBoardColumn(status, filter),
    staleTime: 30_000,
  });
}
