import { readFile } from "node:fs/promises";

/**
 * Normalizza il testo del compose per l'invio a Dokploy e per il confronto:
 * BOM, CRLF, spazi a fondo riga e righe vuote finali non contano.
 */
export function normalizeCompose(text) {
  const lines = (text ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+$/, ""));

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Il corpo inviato è quello che Dokploy deve restituire: a meno di BOM, CRLF e
 * spazi finali, il confronto è testuale. Nessuna dipendenza da installare:
 * questo script gira nel job di deploy senza `pnpm install`.
 */
export function sameCompose(localText, storedText) {
  return normalizeCompose(localText) === normalizeCompose(storedText);
}

/** Riga (1-based) della prima differenza, per un errore leggibile. */
export function firstDifferenceLine(localText, storedText) {
  const local = normalizeCompose(localText).split("\n");
  const stored = normalizeCompose(storedText).split("\n");
  const length = Math.max(local.length, stored.length);

  for (let index = 0; index < length; index++) {
    if (local[index] !== stored[index]) {
      return index + 1;
    }
  }

  return 0;
}

export async function readCompose(path) {
  return normalizeCompose(await readFile(path, "utf8"));
}
