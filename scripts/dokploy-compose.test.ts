import { describe, expect, it } from "vitest";

import { changedServices, normalizeCompose, sameComposeSemantics } from "./dokploy-compose.mjs";

const image = '"ghcr.io/cgiovanni96/nando:${IMAGE_TAG:?IMAGE_TAG required}"';

const compose = `x-app: &app
  image: ${image}
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

describe("sameComposeSemantics", () => {
  it("ignora CRLF, commenti e spazi", () => {
    const stored = `# commento aggiunto da Dokploy\r\n${compose.replace(/\n/g, "\r\n")}`;

    expect(sameComposeSemantics(compose, stored)).toBe(true);
  });

  it("riconosce un command diverso", () => {
    const stored = compose.replace("/app/web/server/index.mjs", "/app/api/index.mjs");

    expect(sameComposeSemantics(compose, stored)).toBe(false);
  });

  it("riconosce una porta diversa", () => {
    const stored = compose.replace("127.0.0.1:3002:3002", "127.0.0.1:3003:3002");

    expect(sameComposeSemantics(compose, stored)).toBe(false);
  });

  it("tratta un compose vuoto come diverso", () => {
    expect(sameComposeSemantics(compose, "")).toBe(false);
  });
});

describe("changedServices", () => {
  it("elenca solo i servizi che differiscono", () => {
    const stored = compose.replace("127.0.0.1:3002:3002", "127.0.0.1:3003:3002");

    expect(changedServices(compose, stored)).toEqual(["web"]);
  });

  it("non segnala nulla quando gli anchor sono scritti in forma diversa", () => {
    const expanded = `services:
  api:
    image: ${image}
    restart: unless-stopped
    command: ["node", "/app/api/index.mjs"]
  web:
    image: ${image}
    restart: unless-stopped
    command: ["node", "/app/web/server/index.mjs"]
    ports:
      - "127.0.0.1:3002:3002"
`;

    expect(changedServices(compose, expanded)).toEqual([]);
  });

  it("segnala un servizio mancante o aggiunto", () => {
    const withoutWeb = compose.slice(0, compose.indexOf("  web:"));

    expect(changedServices(compose, withoutWeb)).toEqual(["web"]);
    expect(changedServices(withoutWeb, compose)).toEqual(["web"]);
  });
});
