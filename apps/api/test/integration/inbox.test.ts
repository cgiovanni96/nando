import type { InboxSource } from "@nando/core";
import { afterAll, describe, expect, it } from "vitest";

import { createApiApp } from "@api/http/app";
import { errorEnvelopeSchema } from "@api/http/envelope";
import { EXAMPLE_INBOX_ITEM_ID, inboxResponseSchema } from "@api/http/inbox/contract";
import { authHeaders, config, handle } from "./spaces/helpers";

afterAll(async () => {
  await handle.close();
});

const inboxSource: InboxSource = {
  async listUnassigned({ limit }) {
    return [
      {
        entityType: "task",
        id: EXAMPLE_INBOX_ITEM_ID,
        title: "Comprare il pane",
        updatedAt: new Date("2026-11-11T15:12:23.109Z"),
      },
    ].slice(0, limit);
  },
};

const app = createApiApp({ config, db: handle.db, inboxSources: [inboxSource] });

describe("inbox routes", () => {
  it("lists unassigned entities from the registered sources", async () => {
    const response = await app.request("/api/inbox", { headers: authHeaders });
    const parsed = inboxResponseSchema.safeParse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.items).toEqual([
        {
          entityType: "task",
          id: EXAMPLE_INBOX_ITEM_ID,
          title: "Comprare il pane",
          updatedAt: "2026-11-11T15:12:23.109Z",
        },
      ]);
      expect(parsed.data.data.nextCursor).toBeNull();
    }
  });

  it("rejects a missing bearer", async () => {
    const response = await app.request("/api/inbox");
    const parsed = errorEnvelopeSchema.safeParse(await response.json());

    expect(response.status).toBe(401);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("unauthorized");
    }
  });
});
