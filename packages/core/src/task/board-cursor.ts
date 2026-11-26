import { decodeCursor, encodeCursor, isUuid } from "../db/cursor";

/** Cursore keyset della board: chiave di ordinamento e id di rottura. */
export type BoardCursor = {
  key: string | null;
  id: string;
};

/** Codifica il cursore keyset come cursore opaco condiviso. */
export function encodeBoardCursor(value: BoardCursor): string {
  return encodeCursor(value);
}

/**
 * Decodifica il cursore della board. Restituisce `null` per un valore non
 * decodificabile, un id che non è un UUID o una chiave che non è `null` né una
 * stringa interpretabile da `Date`.
 */
export function decodeBoardCursor(value: string): BoardCursor | null {
  const parsed = decodeCursor(value);
  if (!parsed) return null;

  const { key, id } = parsed;
  if (typeof id !== "string" || !isUuid(id)) return null;

  if (key === null) return { key: null, id };
  if (typeof key !== "string") return null;
  if (Number.isNaN(new Date(key).getTime())) return null;

  return { key, id };
}
