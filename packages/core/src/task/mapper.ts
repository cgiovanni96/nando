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
};

/** Legge il task con la sua unica occorrenza M1, escludendo i soft-deleted. */
export async function findTask(db: TaskCommandDb, taskId: string): Promise<Task | null> {
  const [row] = await db
    .select(taskViewColumns)
    .from(task)
    .innerJoin(taskOccurrence, eq(taskOccurrence.taskId, task.id))
    .where(and(eq(task.id, taskId), isNull(task.deletedAt)))
    .limit(1);

  return row ?? null;
}
