import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { browserApiClient } from "@web/lib/browser-api-client";

export type SpaceOption = {
  value: string;
  label: string;
};

type SpaceListResponse = InferResponseType<typeof browserApiClient.api.spaces.$get, 200>;

async function fetchSpaceOptions(): Promise<SpaceOption[]> {
  const response = await browserApiClient.api.spaces.$get({
    query: {
      limit: "100",
      includeArchived: "false",
    },
  });

  if (!response.ok) {
    throw new Error("spaces_unavailable");
  }

  const body = (await response.json()) as SpaceListResponse;

  return body.data.items
    .map((item) => ({ value: item.id, label: item.name }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
}

/**
 * Opzioni Space per il selettore della cattura.
 * TanStack Query deduplica la richiesta tra dashboard e shell.
 */
export const spaceOptionsQueryOptions = queryOptions({
  queryKey: ["spaces", "options"] as const,
  queryFn: fetchSpaceOptions,
  staleTime: 5 * 60_000,
});
