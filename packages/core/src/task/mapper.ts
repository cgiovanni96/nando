import { and, eq, isNull } from "drizzle-orm";

import type { Task } from "./domain";
import type { TaskCommandDb } from "./ports";
import { task, taskOccurrence } from "./schema";

/** Colonne della vista piatta usata da comandi e query. */
export const taskViewColumns = {
  id: task.id,
  title: task.title,
  status: taskOccurrence.status,
  dueAt: taskOccurrence.dueAt,
  spaceId: task.spaceId,
  version: task.version,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  deletedAt: task.deletedAt,
};

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

  return row ?? null;
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
