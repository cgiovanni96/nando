import type { ApiConfig, Database } from "@nando/platform";

export type ApiDeps = {
  config: ApiConfig;
  db: Database;
};

export type ApiEnv = {
  Variables: {
    requestId: string;
    actorId: string;
  };
};
