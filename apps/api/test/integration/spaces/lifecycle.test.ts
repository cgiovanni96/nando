import { newId } from "@nando/kernel";
import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "@api/http/envelope";
import {
  renameSpaceRequestFactory,
  spaceCommandRequestFactory,
  spaceListResponseSchema,
  spaceResponseSchema,
} from "@api/http/spaces/contract";
import { createSpace, get, handle, post, readSpace } from "./helpers";

afterAll(async () => {
  await handle.close();
});

describe("space lifecycle", () => {
  it("archives a subtree, hides it from active lists and restores it", async () => {
    const area = await createSpace({ name: "Vita", kind: "area" });
    const project = await createSpace({ name: "Salute", kind: "project", parentId: area.id });
    const resource = await createSpace({
      name: "Palestra",
      kind: "resource",
      parentId: project.id,
    });

    const archived = await post(
      `/api/spaces/${area.id}/archive`,
      spaceCommandRequestFactory({ commandId: newId() }),
    );
    const archivedParsed = spaceResponseSchema.safeParse(await archived.json());

    expect(archived.status).toBe(200);
    expect(archivedParsed.success).toBe(true);
    if (archivedParsed.success) {
      expect(archivedParsed.data.data.archivedAt).not.toBeNull();
    }

    expect((await readSpace(project.id)).archivedAt).not.toBeNull();
    expect((await readSpace(resource.id)).archivedAt).not.toBeNull();

    const activeList = await get("/api/spaces");
    const activeParsed = spaceListResponseSchema.safeParse(await activeList.json());
    expect(activeParsed.success).toBe(true);
    if (activeParsed.success) {
      expect(activeParsed.data.data.items).toHaveLength(0);
    }

    const allList = await get("/api/spaces?includeArchived=true");
    const allParsed = spaceListResponseSchema.safeParse(await allList.json());
    expect(allParsed.success).toBe(true);
    if (allParsed.success) {
      expect(allParsed.data.data.items).toHaveLength(3);
    }

    const renameArchived = await post(
      `/api/spaces/${area.id}/rename`,
      renameSpaceRequestFactory({ commandId: newId(), name: "Nuovo" }),
    );
    expect(renameArchived.status).toBe(422);

    const unarchiveChild = await post(
      `/api/spaces/${project.id}/unarchive`,
      spaceCommandRequestFactory({ commandId: newId() }),
    );
    const unarchiveChildParsed = errorEnvelopeSchema.safeParse(await unarchiveChild.json());

    expect(unarchiveChild.status).toBe(422);
    expect(unarchiveChildParsed.success).toBe(true);
    if (unarchiveChildParsed.success) {
      expect(unarchiveChildParsed.data.error.code).toBe("domain_rule_violation");
    }

    const unarchived = await post(
      `/api/spaces/${area.id}/unarchive`,
      spaceCommandRequestFactory({ commandId: newId() }),
    );
    const unarchivedParsed = spaceResponseSchema.safeParse(await unarchived.json());

    expect(unarchived.status).toBe(200);
    expect(unarchivedParsed.success).toBe(true);
    if (unarchivedParsed.success) {
      expect(unarchivedParsed.data.data.archivedAt).toBeNull();
    }
    expect((await readSpace(project.id)).archivedAt).toBeNull();
    expect((await readSpace(resource.id)).archivedAt).toBeNull();
  });
});
