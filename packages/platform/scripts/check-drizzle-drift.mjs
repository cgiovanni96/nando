import { execSync } from "node:child_process";

execSync("pnpm exec drizzle-kit generate", { stdio: "inherit" });

const status = execSync("git status --porcelain -- drizzle", { encoding: "utf8" }).trim();

if (status) {
  console.error("[nando] drift fra schema Drizzle e migrazioni:");
  console.error(status);
  console.error("Genera la migrazione con `pnpm db:generate` e committala.");
  process.exit(1);
}

console.log("[nando] migrazioni allineate allo schema");
