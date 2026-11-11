import { describe, expect, it } from "vitest";

import {
  deploymentId,
  deploymentIds,
  deploymentState,
  findTriggeredDeployment,
} from "./dokploy-deployment.mjs";

const older = {
  deploymentId: "dep-1",
  title: "deploy sha-aaa",
  status: "done",
  createdAt: "2026-11-11T10:00:00.000Z",
};

const triggerTitle = "deploy sha-bbb";

describe("deploymentIds", () => {
  it("elenca gli id e ignora quelli assenti", () => {
    expect(deploymentIds([older, { title: "senza id" }, null])).toEqual(["dep-1"]);
  });

  it("regge una risposta non array", () => {
    expect(deploymentIds(undefined)).toEqual([]);
    expect(deploymentIds({ items: [] })).toEqual([]);
  });
});

describe("deploymentId", () => {
  it("accetta deploymentId o id", () => {
    expect(deploymentId({ deploymentId: "a" })).toBe("a");
    expect(deploymentId({ id: "b" })).toBe("b");
    expect(deploymentId({})).toBeNull();
  });
});

describe("findTriggeredDeployment", () => {
  it("trova il deployment nuovo con il titolo del run", () => {
    const triggered = {
      deploymentId: "dep-2",
      title: triggerTitle,
      status: "running",
      createdAt: "2026-11-11T10:05:00.000Z",
    };

    expect(
      findTriggeredDeployment([older, triggered], {
        knownIds: ["dep-1"],
        title: triggerTitle,
      }),
    ).toBe(triggered);
  });

  it("ignora un deploy precedente con lo stesso titolo", () => {
    const previousSameTag = {
      deploymentId: "dep-0",
      title: triggerTitle,
      status: "done",
      createdAt: "2026-11-11T09:00:00.000Z",
    };

    expect(
      findTriggeredDeployment([previousSameTag], {
        knownIds: ["dep-0"],
        title: triggerTitle,
      }),
    ).toBeNull();
  });

  it("ignora i deployment con un altro titolo", () => {
    const other = { deploymentId: "dep-3", title: "deploy altro", status: "done" };

    expect(findTriggeredDeployment([other], { knownIds: [], title: triggerTitle })).toBeNull();
  });

  it("sceglie il più recente fra due nuovi con lo stesso titolo", () => {
    const first = { deploymentId: "dep-4", title: triggerTitle, createdAt: "2026-11-11T10:05:00Z" };
    const second = {
      deploymentId: "dep-5",
      title: triggerTitle,
      createdAt: "2026-11-11T10:06:00Z",
    };

    expect(findTriggeredDeployment([first, second], { knownIds: [], title: triggerTitle })).toBe(
      second,
    );
  });

  it("restituisce null quando non c'è ancora nulla", () => {
    expect(
      findTriggeredDeployment([older], { knownIds: ["dep-1"], title: triggerTitle }),
    ).toBeNull();
    expect(findTriggeredDeployment(undefined, { title: triggerTitle })).toBeNull();
  });
});

describe("deploymentState", () => {
  it("mappa gli stati terminali di Dokploy", () => {
    expect(deploymentState({ status: "done" })).toBe("done");
    expect(deploymentState({ status: "error" })).toBe("failed");
    expect(deploymentState({ status: "cancelled" })).toBe("failed");
  });

  it("tratta running, sconosciuto e assente come pending", () => {
    expect(deploymentState({ status: "running" })).toBe("pending");
    expect(deploymentState({ status: "qualcosa" })).toBe("pending");
    expect(deploymentState({})).toBe("pending");
    expect(deploymentState(null)).toBe("pending");
  });

  it("non distingue maiuscole e minuscole", () => {
    expect(deploymentState({ status: "DONE" })).toBe("done");
    expect(deploymentState({ status: "Error" })).toBe("failed");
  });
});
