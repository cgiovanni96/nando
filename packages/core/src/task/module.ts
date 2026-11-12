import type { Clock } from "@nando/kernel";

import { createTaskCommands } from "./commands";
import type { TaskDatabase, TaskSpacePort } from "./ports";
import { createTaskQueries } from "./queries";

export type TaskModuleDeps = {
  db: TaskDatabase;
  clock: Clock;
  ids: () => string;
  spacePort: TaskSpacePort;
};

export function createTaskModule({ db, clock, ids, spacePort }: TaskModuleDeps) {
  return {
    commands: createTaskCommands({ db, clock, ids, spacePort }),
    queries: createTaskQueries({ db }),
  };
}

export type TaskModule = ReturnType<typeof createTaskModule>;
