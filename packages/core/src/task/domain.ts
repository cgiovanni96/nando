import type { DomainError } from "@nando/kernel";

export const TASK_STATUSES = ["open", "completed", "skipped", "cancelled"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TITLE_MAX_LENGTH = 500;

/** Finestra di grazia della deletion prima della purge (ADR-0011). */
export const TASK_DELETION_GRACE_DAYS = 7;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const TASK_STATUS_TARGETS = {
  complete: "completed",
  skip: "skipped",
  cancel: "cancelled",
} as const;

export type TaskStatusCommand = keyof typeof TASK_STATUS_TARGETS;

/**
 * Vista piatta del task: titolo e Space vengono dalla definizione, stato e
 * scadenza dall'occorrenza. L'API espone un solo oggetto.
 */
export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: Date | null;
  dueAtHasTime: boolean;
  spaceId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** Ciò che il modulo Task deve sapere di uno Space, senza importarne lo schema. */
export type TaskSpaceSnapshot = {
  id: string;
  archivedAt: Date | null;
  deletedAt: Date | null;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "aperto",
  completed: "completato",
  skipped: "saltato",
  cancelled: "cancellato",
};

export function normalizeTaskTitle(title: string): string {
  return title.trim();
}

export function titleViolation(title: string): DomainError | null {
  const normalized = normalizeTaskTitle(title);

  if (normalized.length === 0) {
    return { code: "validation_error", message: "Il titolo del task è obbligatorio." };
  }

  if (normalized.length > TASK_TITLE_MAX_LENGTH) {
    return {
      code: "validation_error",
      message: `Il titolo del task non può superare ${TASK_TITLE_MAX_LENGTH} caratteri.`,
    };
  }

  return null;
}

export function dueAtViolation(dueAt: Date | null): DomainError | null {
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return { code: "validation_error", message: "La scadenza del task non è valida." };
  }

  return null;
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return status !== "open";
}

/**
 * Una transizione ammessa parte solo da `open`. Lo stesso stato è un no-op
 * idempotente; gli stati terminali non si riaprono in M1 (serve una
 * Rectification, ADR-0004).
 */
export function transitionViolation(from: TaskStatus, to: TaskStatus): DomainError | null {
  if (from === to || from === "open") return null;

  return {
    code: "domain_rule_violation",
    message: `Un task ${STATUS_LABELS[from]} non può passare a ${STATUS_LABELS[to]}.`,
  };
}

/**
 * Uno Space archiviato è in sola lettura; uno cancellato non esiste per le
 * viste attive.
 */
export function spaceViolation(space: TaskSpaceSnapshot | null): DomainError | null {
  if (!space || space.deletedAt) {
    return { code: "not_found", message: "Space non trovato." };
  }

  if (space.archivedAt) {
    return { code: "domain_rule_violation", message: "Uno Space archiviato è in sola lettura." };
  }

  return null;
}

/**
 * Ultimo istante in cui un task cancellato è ancora ripristinabile.
 * Il calcolo è puro: la finestra è un dato di dominio, non una configurazione.
 */
export function restorableUntil(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TASK_DELETION_GRACE_DAYS * DAY_IN_MILLISECONDS);
}

/**
 * Un task cancellato si ripristina solo dentro la finestra di grazia.
 * Un task attivo non ha nulla da ripristinare: il comando è un no-op.
 */
export function restoreViolation(deletedAt: Date | null, now: Date): DomainError | null {
  if (!deletedAt) return null;

  const deadline = restorableUntil(deletedAt);

  if (now.getTime() > deadline.getTime()) {
    return {
      code: "domain_rule_violation",
      message: "La finestra di grazia è scaduta: il task non è più ripristinabile.",
      details: { restorableUntil: deadline.toISOString() },
    };
  }

  return null;
}
