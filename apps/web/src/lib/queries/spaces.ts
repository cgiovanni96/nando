import { queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { browserApiClient } from "@web/lib/browser-api-client";

export type SpaceOption = {
  value: string;
  label: string;
};

type SpaceListResponse = InferResponseType<typeof browserApiClient.api.spaces.$get, 200>;
type SpaceDetailResponse = InferResponseType<
  (typeof browserApiClient.api.spaces)[":spaceId"]["$get"],
  200
>;

export type SpaceDetail = SpaceDetailResponse["data"];

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

async function fetchSpace(spaceId: string): Promise<SpaceDetail> {
  const response = await browserApiClient.api.spaces[":spaceId"].$get({ param: { spaceId } });

  if (!response.ok) {
    throw new Error("space_unavailable");
  }

  const body = (await response.json()) as SpaceDetailResponse;

  return body.data;
}

/**
 * Dettaglio di uno Space: la pagina del task lo usa per sapere se è archiviato
 * e mostrare il banner di sola lettura (ADR-0002).
 */
export function spaceQueryOptions(spaceId: string) {
  return queryOptions({
    queryKey: ["spaces", "detail", spaceId] as const,
    queryFn: () => fetchSpace(spaceId),
    staleTime: 60_000,
  });
}

/**
 * Percorso dello Space risalendo i `parentId`: il breadcrumb della pagina task
 * mostra `Area / Progetto`, come il mock. La profondità PARA è piccola e ogni
 * Space resta in cache, quindi la catena costa al massimo qualche query.
 */
async function fetchSpacePath(spaceId: string): Promise<string[]> {
  const names: string[] = [];
  let currentId: string | null = spaceId;

  while (currentId && names.length < 8) {
    const space = await fetchSpace(currentId);
    names.unshift(space.name);
    currentId = space.parentId;
  }

  return names;
}

export function spacePathQueryOptions(spaceId: string) {
  return queryOptions({
    queryKey: ["spaces", "path", spaceId] as const,
    queryFn: () => fetchSpacePath(spaceId),
    staleTime: 5 * 60_000,
  });
}
