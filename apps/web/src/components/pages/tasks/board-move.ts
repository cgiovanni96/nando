import type { BoardStatus } from "@web/lib/queries/board";

/** Comando HTTP che porta una card da una colonna all'altra (ADR-0028). */
export type BoardCommand =
  | { kind: "complete" }
  | { kind: "start" }
  | { kind: "todo" }
  | { kind: "reopen"; to: "open" | "in_progress" };

/**
 * Mappa lo spostamento tra le colonne sul comando del dominio: verso Fatto si
 * completa, da Fatto si torna indietro solo con una riapertura, che è una
 * rettifica. La stessa colonna non produce alcun comando.
 */
export function boardCommand(from: BoardStatus, to: BoardStatus): BoardCommand | null {
  if (from === to) return null;

  if (to === "completed") return { kind: "complete" };

  if (from === "completed") return { kind: "reopen", to };

  return to === "in_progress" ? { kind: "start" } : { kind: "todo" };
}
