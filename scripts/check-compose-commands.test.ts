import { describe, expect, it } from "vitest";

import { missingServices, servicesMissingCommand } from "./check-compose-commands.mjs";

const appImage = "ghcr.io/cgiovanni96/nando:${IMAGE_TAG:?IMAGE_TAG required}";
const dbImage = "pgvector/pgvector:pg17";

describe("servicesMissingCommand", () => {
  it("segnala i servizi dell'app senza command", () => {
    const document = {
      services: {
        api: { image: appImage },
        db: { image: dbImage },
      },
    };

    expect(servicesMissingCommand(document)).toEqual(["api"]);
  });

  it("accetta i servizi dell'app con command", () => {
    const document = {
      services: {
        api: { image: appImage, command: ["node", "/app/api/index.mjs"] },
        web: { image: appImage, command: ["node", "/app/web/server/index.mjs"] },
      },
    };

    expect(servicesMissingCommand(document)).toEqual([]);
  });

  it("ignora le immagini esterne e un command vuoto non vale", () => {
    const document = {
      services: {
        db: { image: dbImage },
        worker: { image: appImage, command: [] },
      },
    };

    expect(servicesMissingCommand(document)).toEqual(["worker"]);
  });

  it("non esplode con un documento vuoto", () => {
    expect(servicesMissingCommand({})).toEqual([]);
    expect(servicesMissingCommand(null)).toEqual([]);
  });
});

describe("missingServices", () => {
  it("elenca i servizi attesi assenti", () => {
    const document = { services: { api: {}, web: {} } };

    expect(missingServices(document, ["migrate", "api", "web", "worker"])).toEqual([
      "migrate",
      "worker",
    ]);
  });

  it("non segnala nulla quando ci sono tutti", () => {
    const document = { services: { migrate: {}, api: {}, web: {}, worker: {} } };

    expect(missingServices(document, ["migrate", "api", "web", "worker"])).toEqual([]);
  });

  it("senza elenco atteso non pretende servizi", () => {
    expect(missingServices({}, [])).toEqual([]);
    expect(missingServices(null, undefined)).toEqual([]);
  });
});
