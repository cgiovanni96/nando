export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Limita il page size al massimo condiviso dalle liste. */
export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

/** Cursore opaco: base64url di un oggetto JSON. */
export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** `true` quando la stringa ha la forma di un UUID (con o senza versione). */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Cursore delle liste ordinate per id UUIDv7 crescente o decrescente. */
export function decodeIdCursor(value: string): string | null {
  const parsed = decodeCursor(value);
  const id = parsed?.id;

  return typeof id === "string" && isUuid(id) ? id : null;
}
