import { describe, expect, it } from "vitest";

import { firstDifferenceLine, normalizeCompose, sameCompose } from "./dokploy-compose.mjs";

const compose = `x-app: &app
  image: "ghcr.io/cgiovanni96/nando:\${IMAGE_TAG:?IMAGE_TAG required}"
  restart: unless-stopped
services:
  api:
    <<: *app
    command: ["node", "/app/api/index.mjs"]
  web:
    <<: *app
    command: ["node", "/app/web/server/index.mjs"]
    ports:
      - "127.0.0.1:3002:3002"
`;

describe("normalizeCompose", () => {
  it("normalizza BOM, CRLF, spazi finali e righe vuote", () => {
    const raw = `\uFEFFservices:\r\n  api:\r\n    image: x   \r\n\r\n\r\n`;

    expect(normalizeCompose(raw)).toBe("services:\n  api:\n    image: x\n");
  });

  it("è idempotente", () => {
    expect(normalizeCompose(normalizeCompose(compose))).toBe(normalizeCompose(compose));
  });

  it("gestisce un testo vuoto", () => {
    expect(normalizeCompose("")).toBe("\n");
  });
});

describe("sameCompose", () => {
  it("ignora CRLF e spazi finali", () => {
    const stored = compose.replace(/\n/g, "\r\n").replace("x-app: &app\r\n", "x-app: &app   \r\n");

    expect(sameCompose(compose, stored)).toBe(true);
  });

  it("riconosce un command diverso", () => {
    const stored = compose.replace("/app/web/server/index.mjs", "/app/api/index.mjs");

    expect(sameCompose(compose, stored)).toBe(false);
  });

  it("riconosce una porta diversa", () => {
    const stored = compose.replace("127.0.0.1:3002:3002", "127.0.0.1:3003:3002");

    expect(sameCompose(compose, stored)).toBe(false);
  });

  it("tratta un compose vuoto come diverso", () => {
    expect(sameCompose(compose, "")).toBe(false);
  });
});

describe("firstDifferenceLine", () => {
  it("indica la riga della prima differenza", () => {
    const stored = compose.replace("127.0.0.1:3002:3002", "127.0.0.1:3003:3002");

    expect(firstDifferenceLine(compose, stored)).toBe(12);
  });

  it("con testi uguali restituisce 0", () => {
    expect(firstDifferenceLine(compose, compose)).toBe(0);
  });

  it("segnala un compose troncato", () => {
    expect(firstDifferenceLine(compose, "")).toBe(1);
  });
});
