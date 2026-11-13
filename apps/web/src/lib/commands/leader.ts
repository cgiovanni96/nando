export const LEADER_KEY = "n";
export const LEADER_TIMEOUT_MS = 800;

export type LeaderCommand = "capture" | "dashboard" | "inbox" | "trash";

export type LeaderState = { startedAt: number } | null;

const SECOND_KEYS: Record<string, LeaderCommand> = {
  n: "capture",
  d: "dashboard",
  i: "inbox",
  t: "trash",
};

/**
 * Tasti che non devono avviare sequenze mentre l'utente sta scrivendo.
 * `contenteditable` copre anche l'editor futuro.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/** I leader non devono navigare dietro una modale o un drawer. */
export function isInsideDialog(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return target.closest('[role="dialog"], [aria-modal="true"]') !== null;
}

/**
 * Macchina a stati della sequenza `n <tasto>`.
 *
 * Il primo `n` apre la finestra; il secondo tasto entro 800 ms produce il
 * comando. Fuori dalla finestra non produce nulla, tranne un nuovo `n` che
 * riapre la sequenza.
 */
export function nextLeaderCommand(
  state: LeaderState,
  key: string,
  now: number,
): { state: LeaderState; command: LeaderCommand | null } {
  if (state && now - state.startedAt <= LEADER_TIMEOUT_MS) {
    const command = SECOND_KEYS[key];

    return { state: null, command: command ?? null };
  }

  if (key === LEADER_KEY) {
    return { state: { startedAt: now }, command: null };
  }

  return { state: null, command: null };
}
