import { describe, expect, it } from "vitest";

import { replaceImageTag } from "./dokploy-env.mjs";

describe("replaceImageTag", () => {
  it("replaces an existing IMAGE_TAG", () => {
    expect(replaceImageTag("POSTGRES_PASSWORD=secret\nIMAGE_TAG=sha-old\n", "sha-new")).toBe(
      "POSTGRES_PASSWORD=secret\nIMAGE_TAG=sha-new\n",
    );
  });

  it("appends IMAGE_TAG when missing", () => {
    expect(replaceImageTag("POSTGRES_PASSWORD=secret", "sha-new")).toBe(
      "POSTGRES_PASSWORD=secret\nIMAGE_TAG=sha-new\n",
    );
  });

  it("handles an empty environment", () => {
    expect(replaceImageTag("", "sha-new")).toBe("IMAGE_TAG=sha-new\n");
  });

  it("keeps only one IMAGE_TAG when duplicated", () => {
    expect(replaceImageTag("IMAGE_TAG=one\nIMAGE_TAG=two\n", "sha-new")).toBe(
      "IMAGE_TAG=sha-new\n",
    );
  });
});
