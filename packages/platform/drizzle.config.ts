import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/db/schema/*.ts", "../core/src/db/schema/*.ts", "../core/src/*/schema.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://nando:nando@127.0.0.1:5432/nando_dev",
  },
  strict: true,
  verbose: true,
});
