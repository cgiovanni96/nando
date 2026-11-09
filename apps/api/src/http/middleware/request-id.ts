import { newId } from "@nando/kernel";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

import type { ApiEnv } from "../types";

export const requestId = createMiddleware<ApiEnv>(async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const id = incoming && z.uuid().safeParse(incoming).success ? incoming : newId();

  c.set("requestId", id);
  c.header("x-request-id", id);

  await next();
});
