import { describe, expect, it } from "vitest";

import { envValue, replaceImageTag } from "./dokploy-env.mjs";

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

describe("envValue", () => {
  it("legge il valore di una variabile", () => {
    expect(envValue("POSTGRES_DB=nando_staging\nIMAGE_TAG=sha-abc\n", "IMAGE_TAG")).toBe("sha-abc");
  });

  it("regge CRLF e righe senza value", () => {
    expect(envValue("IMAGE_TAG=sha-abc\r\nALTRA=1\r\n", "IMAGE_TAG")).toBe("sha-abc");
  });

  it("restituisce undefined quando la variabile manca", () => {
    expect(envValue("POSTGRES_DB=nando_staging\n", "IMAGE_TAG")).toBeUndefined();
    expect(envValue(undefined, "IMAGE_TAG")).toBeUndefined();
  });
});
