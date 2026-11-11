import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parse } from "yaml";

const COMPOSE_FILES = [
  "deploy/docker-compose.yml",
  "deploy/compose.staging.yml",
  "deploy/compose.dev.yml",
];

// I servizi dell'immagine applicativa derivano IMAGE_TAG; le immagini esterne
// (Postgres) non hanno command e non devono averlo.
const APP_IMAGE_MARKER = "${IMAGE_TAG";

function hasCommand(service) {
  return Array.isArray(service?.command) && service.command.length > 0;
}

/**
 * Nomi dei servizi dell'app che non dichiarano un `command`.
 * L'immagine ha un solo CMD (web): senza `command` api e worker eseguono web.
 */
export function servicesMissingCommand(document) {
  const services = document?.services ?? {};

  return Object.entries(services)
    .filter(([, service]) => {
      const image = typeof service?.image === "string" ? service.image : "";
      return image.includes(APP_IMAGE_MARKER) && !hasCommand(service);
    })
    .map(([name]) => name);
}

async function main() {
  const problems = [];

  for (const file of COMPOSE_FILES) {
    const document = parse(await readFile(file, "utf8"));

    for (const service of servicesMissingCommand(document)) {
      problems.push(`${file}: il servizio "${service}" non dichiara command`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`[nando] ${problem}`);
    }

    console.error(
      "[nando] ogni servizio dell'app deve dichiarare command: api, web, worker e migrate.",
    );
    process.exit(1);
  }

  console.log(`[nando] command esplicito presente in ${COMPOSE_FILES.join(", ")}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[nando] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
}
