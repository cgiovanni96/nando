import type { TaskDetail } from "@web/lib/queries/tasks";

export type TaskStatus = TaskDetail["status"];

/** Ordine delle opzioni del selettore di stato. */
export const STATUS_ORDER = ["open", "in_progress", "completed", "skipped", "cancelled"] as const;

/** Comando HTTP che porta l'occorrenza da `from` a `to`, o `null` se non ammesso. */
export type StatusCommand =
  | { kind: "start" }
  | { kind: "todo" }
  | { kind: "complete" }
  | { kind: "skip" }
  | { kind: "cancel" }
  | { kind: "reopen"; to: "open" | "in_progress" };

/**
 * Mappa il cambio di stato richiesto dalla UI sul comando del dominio
 * (ADR-0004, ADR-0028): da completato si torna indietro solo con una
 * riapertura, che è una rettifica; saltato e cancellato non si lasciano.
 */
export function statusCommand(from: TaskStatus, to: TaskStatus): StatusCommand | null {
  if (from === to) return null;

  if (from === "completed") {
    return to === "open" || to === "in_progress" ? { kind: "reopen", to } : null;
  }
  if (from !== "open" && from !== "in_progress") return null;

  switch (to) {
    case "open":
      return { kind: "todo" };
    case "in_progress":
      return { kind: "start" };
    case "completed":
      return { kind: "complete" };
    case "skipped":
      return { kind: "skip" };
    case "cancelled":
      return { kind: "cancel" };
  }
}
