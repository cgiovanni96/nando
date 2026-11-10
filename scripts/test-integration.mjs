import { execFileSync, execSync } from "node:child_process";

const composeFile = "deploy/compose.dev.yml";
const defaultTestDatabaseUrl = "postgres://nando:nando@127.0.0.1:5433/nando_test";

function fail(message) {
  console.error(`[nando] ${message}`);
  process.exit(1);
}

function dockerAvailable() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

function compose(...args) {
  return execFileSync("docker", ["compose", "-f", composeFile, ...args], {
    stdio: "inherit",
  });
}

function ensureTestDatabase() {
  const exists = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "nando",
      "-d",
      "postgres",
      "-tAc",
      "SELECT 1 FROM pg_database WHERE datname = 'nando_test'",
    ],
    { encoding: "utf8" },
  ).trim();

  if (exists !== "1") {
    compose(
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "nando",
      "-d",
      "postgres",
      "-c",
      "CREATE DATABASE nando_test",
    );
  }
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;

if (!process.env.TEST_DATABASE_URL) {
  if (!dockerAvailable()) {
    fail(
      [
        "Postgres di test non disponibile.",
        "Avvia Docker e riprova, oppure imposta TEST_DATABASE_URL a un Postgres 17 + pgvector raggiungibile.",
        "La suite integration non viene saltata in silenzio.",
      ].join("\n"),
    );
  }

  try {
    compose("up", "-d", "--wait");
    ensureTestDatabase();
  } catch {
    fail(
      "Impossibile preparare il Postgres di test. Controlla `docker compose -f deploy/compose.dev.yml ps`.",
    );
  }
}

try {
  execSync("pnpm exec vitest run --project integration", {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
      TEST_DATABASE_URL: testDatabaseUrl,
    },
  });
} catch {
  fail(
    "Suite integration fallita. Controlla TEST_DATABASE_URL e che Postgres 17 + pgvector sia raggiungibile.",
  );
}
