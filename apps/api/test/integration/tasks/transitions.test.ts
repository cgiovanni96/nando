import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "../../../src/http/envelope";
import { taskCommandRequestFactory, taskResponseSchema } from "../../../src/http/tasks/contract";
import { createTask, handle, post } from "./helpers";

afterAll(async () => {
  await handle.close();
});

async function runStatus(taskId: string, action: "complete" | "skip" | "cancel") {
  const response = await post(
    `/api/tasks/${taskId}/${action}`,
    taskCommandRequestFactory({ commandId: newId() }),
  );
  const parsed = taskResponseSchema.safeParse(await response.json());

  return { response, parsed };
}

describe("task status transitions", () => {
  it("completes an open task and treats a second completion as a no-op", async () => {
    const task = await createTask({ title: "Da completare" });

    const first = await runStatus(task.id, "complete");
    expect(first.response.status).toBe(200);
    expect(first.parsed.success).toBe(true);
    if (first.parsed.success) {
      expect(first.parsed.data.data.status).toBe("completed");
      expect(first.parsed.data.data.version).toBe(2);
    }

    const replay = await runStatus(task.id, "complete");
    expect(replay.response.status).toBe(200);
    if (replay.parsed.success) {
      expect(replay.parsed.data.data.status).toBe("completed");
      expect(replay.parsed.data.data.version).toBe(2);
    }

    const skipCompleted = await post(
      `/api/tasks/${task.id}/skip`,
      taskCommandRequestFactory({ commandId: newId() }),
    );
    const parsed = errorEnvelopeSchema.safeParse(await skipCompleted.json());

    expect(skipCompleted.status).toBe(422);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("domain_rule_violation");
    }
  });

  it("skips an open task and refuses to cancel it afterwards", async () => {
    const task = await createTask({ title: "Da saltare" });
    const skipped = await runStatus(task.id, "skip");

    expect(skipped.response.status).toBe(200);
    if (skipped.parsed.success) {
      expect(skipped.parsed.data.data.status).toBe("skipped");
      expect(skipped.parsed.data.data.version).toBe(2);
    }

    const cancelSkipped = await runStatus(task.id, "cancel");
    expect(cancelSkipped.response.status).toBe(422);
  });

  it("cancels an open task and refuses to complete it afterwards", async () => {
    const task = await createTask({ title: "Da cancellare" });
    const cancelled = await runStatus(task.id, "cancel");

    expect(cancelled.response.status).toBe(200);
    if (cancelled.parsed.success) {
      expect(cancelled.parsed.data.data.status).toBe("cancelled");
      expect(cancelled.parsed.data.data.version).toBe(2);
    }

    const completeCancelled = await runStatus(task.id, "complete");
    expect(completeCancelled.response.status).toBe(422);
  });

  it("returns not_found for a status command on an unknown task", async () => {
    const response = await post(
      "/api/tasks/0199a4c2-7a10-7000-8000-000000000999/complete",
      taskCommandRequestFactory({ commandId: newId() }),
    );
    const parsed = errorEnvelopeSchema.safeParse(await response.json());

    expect(response.status).toBe(404);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("not_found");
    }
  });
});
