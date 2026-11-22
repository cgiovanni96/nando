import { and, eq, isNull } from "drizzle-orm";

import type { Task } from "./domain";
import type { Schedule } from "./schedule";
import type { TaskCommandDb } from "./ports";
import { task, taskOccurrence } from "./schema";

/** Colonne della vista piatta usata da comandi e query; `toTask` le compone. */
export const taskViewColumns = {
  id: task.id,
  title: task.title,
  status: taskOccurrence.status,
  timeZone: task.timeZone,
  allDay: taskOccurrence.allDay,
  startDate: taskOccurrence.startDate,
  endDate: taskOccurrence.endDate,
  startAt: taskOccurrence.startAt,
  endAt: taskOccurrence.endAt,
  spaceId: task.spaceId,
  version: task.version,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  deletedAt: task.deletedAt,
};

export type TaskViewRow = {
  id: string;
  title: string;
  status: Task["status"];
  timeZone: string;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startAt: Date | null;
  endAt: Date | null;
  spaceId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** Ricompone lo Schedule dalle colonne tipizzate; il check del database garantisce la forma. */
export function scheduleFromRow(row: TaskViewRow): Schedule | null {
  if (row.allDay && row.endDate) {
    return { allDay: true, from: row.startDate, to: row.endDate, timeZone: row.timeZone };
  }
  if (!row.allDay && row.endAt) {
    return { allDay: false, from: row.startAt, to: row.endAt, timeZone: row.timeZone };
  }
  return null;
}

/** Colonne dell'occorrenza che rappresentano uno Schedule, o nessuno. */
export function scheduleColumns(schedule: Schedule | null) {
  if (!schedule) {
    return { allDay: false, startDate: null, endDate: null, startAt: null, endAt: null };
  }
  return schedule.allDay
    ? { allDay: true, startDate: schedule.from, endDate: schedule.to, startAt: null, endAt: null }
    : { allDay: false, startDate: null, endDate: null, startAt: schedule.from, endAt: schedule.to };
}

export function toTask(row: TaskViewRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    schedule: scheduleFromRow(row),
    timeZone: row.timeZone,
    spaceId: row.spaceId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

async function selectTask(
  db: TaskCommandDb,
  taskId: string,
  includeDeleted: boolean,
): Promise<Task | null> {
  const condition = includeDeleted
    ? eq(task.id, taskId)
    : and(eq(task.id, taskId), isNull(task.deletedAt));

  const [row] = await db
    .select(taskViewColumns)
    .from(task)
    .innerJoin(taskOccurrence, eq(taskOccurrence.taskId, task.id))
    .where(condition)
    .limit(1);

  return row ? toTask(row) : null;
}

/** Legge il task attivo con la sua unica occorrenza M1, escludendo i soft-deleted. */
export async function findTask(db: TaskCommandDb, taskId: string): Promise<Task | null> {
  return selectTask(db, taskId, false);
}

/**
 * Legge il task anche dentro la finestra di grazia: la deletion nasconde dalle
 * viste, non dai dati (ADR-0011). Serve a `delete`, `restore` e alla lettura
 * per id, che deve rendere il task interrogabile.
 */
export async function findTaskIncludingDeleted(
  db: TaskCommandDb,
  taskId: string,
): Promise<Task | null> {
  return selectTask(db, taskId, true);
}
