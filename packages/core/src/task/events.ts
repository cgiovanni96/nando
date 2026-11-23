/**
 * Eventi del modulo Task (ADR-0004). Fanno parte del contratto: Habits li
 * consumerà in M5 per creare e rettificare le evidenze, deduplicate per
 * `activityId`. Oggi non c'è un bus né un consumatore.
 */
export type TaskCompleted = {
  type: "TaskCompleted";
  taskId: string;
  occurrenceId: string;
  completionId: string;
  activityId: string;
  occurredAt: Date;
};

export type TaskCompletionReverted = {
  type: "TaskCompletionReverted";
  taskId: string;
  occurrenceId: string;
  completionId: string;
  activityId: string;
  rectificationId: string;
  occurredAt: Date;
};

export type TaskEvent = TaskCompleted | TaskCompletionReverted;
