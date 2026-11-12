import { afterAll, describe, expect, it } from "vitest";

import { errorEnvelopeSchema } from "../../../src/http/envelope";
import { spaceListResponseSchema } from "../../../src/http/spaces/contract";
import { createSpace, get, handle } from "./helpers";

afterAll(async () => {
  await handle.close();
});

describe("space queries", () => {
  it("paginates spaces with an opaque cursor", async () => {
    await createSpace({ name: "Vita", kind: "area" });
    await createSpace({ name: "Lavoro", kind: "area" });
    await createSpace({ name: "Casa", kind: "area" });

    const first = await get("/api/spaces?limit=2");
    const firstParsed = spaceListResponseSchema.safeParse(await first.json());

    expect(first.status).toBe(200);
    expect(firstParsed.success).toBe(true);
    if (!firstParsed.success) return;

    expect(firstParsed.data.data.items).toHaveLength(2);
    expect(firstParsed.data.data.nextCursor).toEqual(expect.any(String));

    const cursor = firstParsed.data.data.nextCursor;
    if (!cursor) return;

    const second = await get(`/api/spaces?limit=2&cursor=${encodeURIComponent(cursor)}`);
    const secondParsed = spaceListResponseSchema.safeParse(await second.json());

    expect(secondParsed.success).toBe(true);
    if (secondParsed.success) {
      expect(secondParsed.data.data.items).toHaveLength(1);
      expect(secondParsed.data.data.nextCursor).toBeNull();

      const firstIds = firstParsed.data.data.items.map((item) => item.id);
      const secondIds = secondParsed.data.data.items.map((item) => item.id);
      expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    }
  });

  it("returns not_found for an unknown space", async () => {
    const response = await get("/api/spaces/0199a4c2-7a10-7000-8000-000000000999");
    const parsed = errorEnvelopeSchema.safeParse(await response.json());

    expect(response.status).toBe(404);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.error.code).toBe("not_found");
    }
  });

  it("rejects an invalid query and an invalid path parameter", async () => {
    const invalidQuery = await get("/api/spaces?limit=0");
    const invalidQueryParsed = errorEnvelopeSchema.safeParse(await invalidQuery.json());

    expect(invalidQuery.status).toBe(400);
    expect(invalidQueryParsed.success).toBe(true);
    if (invalidQueryParsed.success) {
      expect(invalidQueryParsed.data.error.code).toBe("validation_error");
    }

    const invalidParam = await get("/api/spaces/not-a-uuid");
    const invalidParamParsed = errorEnvelopeSchema.safeParse(await invalidParam.json());

    expect(invalidParam.status).toBe(400);
    expect(invalidParamParsed.success).toBe(true);
    if (invalidParamParsed.success) {
      expect(invalidParamParsed.data.error.code).toBe("validation_error");
    }
  });
});
