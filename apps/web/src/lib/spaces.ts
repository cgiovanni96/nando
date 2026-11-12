import { browserApiClient } from "./browser-api-client";

export type SpaceOption = {
  value: string;
  label: string;
};

type SpaceListBody = {
  ok: true;
  data: {
    items: Array<{ id: string; name: string }>;
  };
};

let cache: Promise<SpaceOption[]> | null = null;

function isSpaceListBody(value: unknown): value is SpaceListBody {
  if (typeof value !== "object" || value === null) return false;

  const body = value as { ok?: unknown; data?: unknown };
  if (body.ok !== true || typeof body.data !== "object" || body.data === null) return false;

  const data = body.data as { items?: unknown };
  return Array.isArray(data.items);
}

async function fetchSpaceOptions(): Promise<SpaceOption[]> {
  const response = await browserApiClient.api.spaces.$get({
    query: {
      limit: "100",
      includeArchived: "false",
    },
  });
  const body: unknown = await response.json();

  if (!response.ok || !isSpaceListBody(body)) {
    throw new Error("spaces_unavailable");
  }

  return body.data.items
    .filter(
      (item): item is { id: string; name: string } =>
        typeof item?.id === "string" && typeof item?.name === "string",
    )
    .map((item) => ({ value: item.id, label: item.name }))
    .toSorted((a, b) => a.label.localeCompare(b.label));
}

/**
 * Opzioni Space per il selettore della cattura.
 *
 * La cache è di modulo: dashboard e shell montano più form, ma la lista viene
 * richiesta una sola volta. In caso di errore la promise viene azzerata, così
 * un nuovo tentativo può riprovare.
 */
export function loadSpaceOptions(): Promise<SpaceOption[]> {
  cache ??= fetchSpaceOptions().catch((error: unknown) => {
    cache = null;
    throw error;
  });

  return cache;
}

/** Da chiamare quando gli Space cambiano; oggi non c'è ancora una UI che li modifichi. */
export function invalidateSpaceOptions(): void {
  cache = null;
}
