import { describe, expect, it } from "vitest";

import { primaryNav, workspaceNav } from "@web/lib/router/navigation";
import { defaultLocale } from "./config";
import { i18n } from "./i18n";
import { it as itCatalog } from "./resources/it";

function leaves(node: unknown, prefix = ""): Array<[string, string]> {
  if (typeof node !== "object" || node === null) return [];

  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value] as [string, string]] : leaves(value, path);
  });
}

describe("catalog", () => {
  it("has no empty message", () => {
    for (const [key, value] of leaves(itCatalog)) {
      expect(value.trim(), key).not.toBe("");
    }
  });
});

describe("i18n", () => {
  it("starts in the default locale", () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe(defaultLocale);
  });

  it("resolves every navigation label", () => {
    for (const entry of [...primaryNav, ...workspaceNav]) {
      expect(i18n.t(entry.labelKey), entry.labelKey).not.toBe(entry.labelKey);
    }
  });

  it("interpolates the coming soon pattern", () => {
    expect(i18n.t("comingSoon.title", { label: "Calendario", milestone: "M2" })).toBe(
      "Calendario — disponibile in M2",
    );
  });
});
