import type { Clock } from "@nando/kernel";

import type { SpaceCommandDeps } from "./commands";
import { createSpaceCommands } from "./commands";
import { createSpaceQueries } from "./queries";
import type { InboxSource, SpaceDatabase } from "./ports";

export type SpaceModuleDeps = {
  db: SpaceDatabase;
  clock: Clock;
  ids: () => string;
  inboxSources?: readonly InboxSource[];
};

export function createSpaceModule({ db, clock, ids, inboxSources = [] }: SpaceModuleDeps) {
  const commandDeps: SpaceCommandDeps = { db, clock, ids };

  return {
    commands: createSpaceCommands(commandDeps),
    queries: createSpaceQueries({ db, inboxSources }),
  };
}

export type SpaceModule = ReturnType<typeof createSpaceModule>;
