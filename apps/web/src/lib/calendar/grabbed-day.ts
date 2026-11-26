import { addDays } from "@web/lib/local-date";

const COLUMNS = 7;

/** Colonna della settimana sotto il puntatore: sette colonne, ai bordi resta nella prima o nell'ultima. */
export function columnDay({
  pointer,
  left,
  width,
  from,
}: {
  pointer: number;
  left: number;
  width: number;
  from: string;
}): string {
  const column = Math.min(
    COLUMNS - 1,
    Math.max(0, Math.floor(((pointer - left) / width) * COLUMNS)),
  );

  return addDays(from, column);
}
