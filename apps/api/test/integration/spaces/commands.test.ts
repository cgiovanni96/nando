import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "../../../src/http/envelope";
import {
  createSpaceRequestFactory,
  renameSpaceRequestFactory,
  spaceResponseSchema,
} from "../../../src/http/spaces/contract";
import { app, createSpace, handle, post } from "./helpers";

afterAll(async () => {
  await handle.close();
});

describe("space commands", () => {
  it("creates a root area with the documented envelope", async () => {
    const created = await createSpace({ name: "Vita", kind: "area" });

    expect(created.name).toBe("Vita");
    expect(created.kind).toBe("area");
    expect(created.parentId).toBeNull();
    expect(created.archivedAt).toBeNull();
    expect(created.version).toBe(1);
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
  });

  it("enforces the PARA grammar", async () => {
    const area = await createSpace({ name: "Vita", kind: "area" });
    const project = await createSpace({
      name: "Salute",
      kind: "project",
      parentId: area.id,
    });
    const resource = await createSpace({
      name: "Palestra",
      kind: "resource",
      parentId: project.id,
    });

    expect(project.parentId).toBe(area.id);
    expect(resource.parentId).toBe(project.id);

    const invalidUnderArea = await post(
      "/api/spaces",
      createSpaceRequestFactory({
        commandId: newId(),
        name: "Fuori posto",
        kind: "resource",
        parentId: area.id,
      }),
    );
    const invalidUnderProject = await post(
      "/api/spaces",
      createSpaceRequestFactory({
        commandId: newId(),
        name: "Fuori posto",
        kind: "project",
        parentId: project.id,
      }),
    );

    expect(invalidUnderArea.status).toBe(422);
    expect(invalidUnderProject.status).toBe(422);

    for (const response of [invalidUnderArea, invalidUnderProject]) {
      const parsed = errorEnvelopeSchema.safeParse(await response.json());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.error.code).toBe("domain_rule_violation");
      }
    }
  });

  it("renames a space without changing its kind", async () => {
    const area = await createSpace({ name: "Vita", kind: "area" });
    const response = await post(
      `/api/spaces/${area.id}/rename`,
      renameSpaceRequestFactory({ commandId: newId(), name: "Vita e salute" }),
    );
    const parsed = spaceResponseSchema.safeParse(await response.json());

    expect(response.status).toBe(200);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.data.name).toBe("Vita e salute");
      expect(parsed.data.data.kind).toBe("area");
      expect(parsed.data.data.version).toBe(2);
    }
  });

  it("replays a create command and rejects a reused commandId with another payload", async () => {
    const commandId = newId();
    const payload = createSpaceRequestFactory({ commandId, name: "Vita", kind: "area" });

    const first = await post("/api/spaces", payload);
    const firstParsed = spaceResponseSchema.safeParse(await first.json());
    const replay = await post("/api/spaces", payload);
    const replayParsed = spaceResponseSchema.safeParse(await replay.json());

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(firstParsed.success).toBe(true);
    expect(replayParsed.success).toBe(true);
    if (firstParsed.success && replayParsed.success) {
      expect(replayParsed.data.data.id).toBe(firstParsed.data.data.id);
    }

    const conflict = await post(
      "/api/spaces",
      createSpaceRequestFactory({ commandId, name: "Altra", kind: "area" }),
    );
    const conflictParsed = errorEnvelopeSchema.safeParse(await conflict.json());

    expect(conflict.status).toBe(409);
    expect(conflictParsed.success).toBe(true);
    if (conflictParsed.success) {
      expect(conflictParsed.data.error.code).toBe("idempotency_key_reuse");
    }
  });

  it("rejects an invalid payload and a missing bearer", async () => {
    const invalid = await post("/api/spaces", {
      commandId: newId(),
      name: "   ",
      kind: "area",
      parentId: null,
    });
    const invalidParsed = errorEnvelopeSchema.safeParse(await invalid.json());

    expect(invalid.status).toBe(400);
    expect(invalidParsed.success).toBe(true);
    if (invalidParsed.success) {
      expect(invalidParsed.data.error.code).toBe("validation_error");
    }

    const unauthorized = await app.request("/api/spaces");
    const unauthorizedParsed = errorEnvelopeSchema.safeParse(await unauthorized.json());

    expect(unauthorized.status).toBe(401);
    expect(unauthorizedParsed.success).toBe(true);
    if (unauthorizedParsed.success) {
      expect(unauthorizedParsed.data.error.code).toBe("unauthorized");
    }

    const unauthorizedNested = await app.request(
      "/api/spaces/0199a4c2-7a10-7000-8000-000000000999/archive",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandId: newId() }),
      },
    );

    expect(unauthorizedNested.status).toBe(401);
  });
});
