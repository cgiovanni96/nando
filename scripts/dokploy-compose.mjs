import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";

import { parse } from "yaml";

/**
 * Normalizza il testo del compose per l'invio a Dokploy e per i confronti:
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

export function composeSemantics(text, source = "compose") {
  try {
    // Compose ammette le merge key YAML (`<<: *app`): vanno risolte, altrimenti
    // lo stesso servizio scritto con o senza anchor sembrerebbe diverso.
    return parse(normalizeCompose(text), { merge: true });
  } catch (error) {
    throw new Error(
      `${source}: YAML non valido: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }
}

/** Confronto semantico: commenti, indentazione e forma degli anchor non sono differenze. */
export function sameComposeSemantics(localText, storedText) {
  return isDeepStrictEqual(
    composeSemantics(localText, "compose locale"),
    composeSemantics(storedText, "compose Dokploy"),
  );
}

/**
 * Nomi dei servizi il cui contenuto differisce fra i due compose.
 * Serve a rendere leggibile un errore che altrimenti direbbe solo "diverso".
 */
export function changedServices(localText, storedText) {
  const local = composeSemantics(localText, "compose locale")?.services ?? {};
  const stored = composeSemantics(storedText, "compose Dokploy")?.services ?? {};
  const names = new Set([...Object.keys(local), ...Object.keys(stored)]);

  return [...names].filter((name) => !isDeepStrictEqual(local[name], stored[name])).toSorted();
}

export async function readCompose(path) {
  return normalizeCompose(await readFile(path, "utf8"));
}
