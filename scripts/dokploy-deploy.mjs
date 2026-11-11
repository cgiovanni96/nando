import { firstDifferenceLine, readCompose, sameCompose } from "./dokploy-compose.mjs";
import {
  deploymentId,
  deploymentIds,
  deploymentState,
  findTriggeredDeployment,
} from "./dokploy-deployment.mjs";
import { envValue, replaceImageTag } from "./dokploy-env.mjs";

const { DOKPLOY_URL, DOKPLOY_API_KEY, DOKPLOY_COMPOSE_ID, IMAGE_TAG, STAGING_URL } = process.env;

const COMPOSE_FILE = new URL("../deploy/compose.staging.yml", import.meta.url);

function fail(message) {
  console.error(`[nando] ${message}`);
  process.exit(1);
}

for (const [name, value] of Object.entries({
  DOKPLOY_URL,
  DOKPLOY_API_KEY,
  DOKPLOY_COMPOSE_ID,
  IMAGE_TAG,
  STAGING_URL,
})) {
  if (!value) fail(`Variabile ${name} mancante.`);
}

const baseUrl = DOKPLOY_URL.replace(/\/+$/, "");
const stagingUrl = STAGING_URL.replace(/\/+$/, "");

async function dokploy(path, init = {}) {
  const response = await fetch(`${baseUrl}/api/${path}`, {
    ...init,
    headers: {
      "x-api-key": DOKPLOY_API_KEY,
      "content-type": "application/json",
      ...init.headers,
    },
  });
  const text = await response.text();

  if (!response.ok) {
    const hint =
      response.status === 401
        ? " (chiave non valida oppure rate limit sull'API: i log Dokploy dicono quale)"
        : "";
    throw new Error(`Dokploy ${path} -> ${response.status}${hint}: ${text.slice(0, 500)}`);
  }

  return text ? JSON.parse(text) : null;
}

async function check(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
}

async function smoke() {
  const urls = [
    `${stagingUrl}/healthz`,
    `${stagingUrl}/api/openapi.json`,
    `${stagingUrl}/api/system/info`,
    `${stagingUrl}/api/reference`,
  ];

  for (const url of urls) {
    await check(url);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listDeployments() {
  const response = await dokploy(
    `deployment.allByCompose?composeId=${encodeURIComponent(DOKPLOY_COMPOSE_ID)}`,
  );

  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;

  return [];
}

function reportDeployment(deployment) {
  if (!deployment) {
    console.error("[nando] nessun deployment Dokploy registrato per questo run.");
    return;
  }

  console.error(
    `[nando] deployment ${deploymentId(deployment) ?? "senza id"}: ` +
      `${deployment.status ?? "stato sconosciuto"} ` +
      `(${deployment.title ?? "senza titolo"}), creato ${deployment.createdAt ?? "?"}`,
  );

  if (deployment.errorMessage) {
    console.error(`[nando] errore riportato da Dokploy: ${deployment.errorMessage}`);
  }

  if (deployment.logPath) {
    console.error(`[nando] log del deployment sulla VPS: sudo tail -n 200 ${deployment.logPath}`);
  }
}

async function main() {
  const composeFile = await readCompose(COMPOSE_FILE);
  const compose = await dokploy(`compose.one?composeId=${encodeURIComponent(DOKPLOY_COMPOSE_ID)}`);

  if (compose.sourceType !== "raw") {
    fail(
      `il compose Dokploy ha sourceType "${compose.sourceType ?? "sconosciuto"}": ` +
        "il corpo inviato dal repository non verrebbe applicato. Riporta l'app a sorgente raw.",
    );
  }

  const env = replaceImageTag(compose.env ?? "", IMAGE_TAG);

  await dokploy("compose.update", {
    method: "POST",
    body: JSON.stringify({ composeId: DOKPLOY_COMPOSE_ID, env, composeFile }),
  });

  const stored = await dokploy(`compose.one?composeId=${encodeURIComponent(DOKPLOY_COMPOSE_ID)}`);
  const storedCompose = stored.composeFile ?? "";

  if (!sameCompose(composeFile, storedCompose)) {
    fail(
      "Dokploy ha salvato un compose diverso da deploy/compose.staging.yml " +
        `(prima differenza alla riga ${firstDifferenceLine(composeFile, storedCompose)}). ` +
        "Il deploy è fermo prima di toccare i container: la versione Dokploy installata " +
        "probabilmente non accetta composeFile dall'API.",
    );
  }

  if (envValue(stored.env ?? "", "IMAGE_TAG") !== IMAGE_TAG) {
    fail(
      `Dokploy ha salvato IMAGE_TAG=${envValue(stored.env ?? "", "IMAGE_TAG") ?? "assente"} ` +
        `invece di ${IMAGE_TAG}. Il deploy è fermo prima di toccare i container.`,
    );
  }

  console.log(`[nando] compose allineato a deploy/compose.staging.yml (${IMAGE_TAG})`);

  const deployTitle = `deploy ${IMAGE_TAG}`;
  const knownIds = deploymentIds(await listDeployments());

  await dokploy("compose.deploy", {
    method: "POST",
    body: JSON.stringify({
      composeId: DOKPLOY_COMPOSE_ID,
      title: deployTitle,
    }),
  });

  console.log(`[nando] deploy Dokploy avviato per ${IMAGE_TAG}`);

  let triggered = null;

  for (let attempt = 1; attempt <= 60; attempt++) {
    let smokeError = null;

    try {
      await smoke();
    } catch (error) {
      smokeError = error;
    }

    try {
      triggered =
        findTriggeredDeployment(await listDeployments(), { knownIds, title: deployTitle }) ??
        triggered;
    } catch (error) {
      console.error(
        `[nando] stato del deployment non disponibile: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    const state = deploymentState(triggered);

    if (state === "failed") {
      reportDeployment(triggered);
      fail(
        `il deployment Dokploy di ${IMAGE_TAG} è ${triggered.status}: ` +
          "le immagini in esecuzione non sono quelle del tag richiesto.",
      );
    }

    if (state === "done" && !smokeError) {
      console.log(
        `[nando] deployment ${deploymentId(triggered)} done; ` +
          `staging healthy su ${stagingUrl} (${IMAGE_TAG})`,
      );
      return;
    }

    if (attempt === 60) {
      reportDeployment(triggered);
      fail(
        `timeout dopo 10 minuti: ${
          triggered
            ? `deployment ${deploymentId(triggered)} ancora ${triggered.status}`
            : "nessun deployment Dokploy registrato per questo run"
        }, smoke ${smokeError ? "non pronto" : "ok"}.`,
      );
    }

    console.log(
      `[nando] tentativo ${attempt}/60: ` +
        `deployment ${triggered ? deploymentState(triggered) : "assente"}, ` +
        `smoke ${smokeError ? "non pronto" : "ok"}` +
        `${smokeError ? ` (${smokeError instanceof Error ? smokeError.message : smokeError})` : ""}`,
    );

    await sleep(10_000);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
