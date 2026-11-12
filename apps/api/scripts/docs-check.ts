import { Validator } from "@seriousme/openapi-schema-validator";
import type { ApiConfig, Database } from "@nando/platform";
import { generateSpecs } from "hono-openapi";

import { createContractApp } from "@api/http/app";
import { contractRoutes } from "@api/http/manifest";
import { openApiOptions } from "@api/http/openapi";

const METHOD_SET = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

const config: ApiConfig = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://nando:nando@127.0.0.1:5432/nando_test",
  OWNER_USER_ID: "0199a4c2-7a10-7000-8000-000000000001",
  INTERNAL_TOKEN: "0123456789abcdef0123456789abcdef",
  DOCS_ENABLED: true,
  PORT: 3000,
  LOG_LEVEL: "silent",
};

const db = new Proxy(
  {},
  {
    get() {
      throw new Error("docs:check non esegue gli handler: il database non è disponibile.");
    },
  },
) as Database;

const spec = await generateSpecs(createContractApp({ config, db }), openApiOptions);
const problems: string[] = [];

const specRoutes = new Set<string>();

for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of Object.keys(item)) {
    if (METHOD_SET.has(method)) {
      specRoutes.add(`${method.toUpperCase()} ${path}`);
    }
  }
}

const manifestRoutes = new Set(contractRoutes.map((route) => `${route.method} ${route.path}`));

for (const route of manifestRoutes) {
  if (!specRoutes.has(route)) {
    problems.push(`Route registrata ma assente dalla spec: ${route}`);
  }
}

for (const route of specRoutes) {
  if (!manifestRoutes.has(route)) {
    problems.push(`Route nella spec ma non nel manifest: ${route}`);
  }
}

for (const [path, item] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (!METHOD_SET.has(method)) continue;

    const responses = (operation as { responses?: Record<string, unknown> }).responses ?? {};

    for (const [status, response] of Object.entries(responses)) {
      const content = (response as { content?: Record<string, unknown> }).content;
      if (!content) continue;

      const json = content["application/json"] as
        { schema?: unknown; example?: unknown; examples?: unknown } | undefined;
      if (!json) continue;

      if (!json.schema) {
        problems.push(`${method.toUpperCase()} ${path} ${status}: schema mancante`);
      }

      if (!json.example && !json.examples) {
        problems.push(`${method.toUpperCase()} ${path} ${status}: esempio mancante`);
      }
    }
  }
}

const validator = new Validator();
const validation = await validator.validate(spec as Record<string, unknown>);

if (!validation.valid) {
  problems.push(
    `Spec OpenAPI ${
      typeof validation.errors === "string"
        ? validation.errors
        : JSON.stringify(validation.errors, null, 2)
    }`,
  );
}

if (problems.length > 0) {
  console.error("[nando] docs:check fallito:");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(`[nando] docs:check ok: ${specRoutes.size} route, OpenAPI ${spec.openapi}`);
