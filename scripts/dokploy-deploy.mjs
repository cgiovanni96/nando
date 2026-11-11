import { replaceImageTag } from "./dokploy-env.mjs";

const { DOKPLOY_URL, DOKPLOY_API_KEY, DOKPLOY_COMPOSE_ID, IMAGE_TAG, STAGING_URL } = process.env;

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
    throw new Error(`Dokploy ${path} -> ${response.status}: ${text.slice(0, 500)}`);
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

async function reportDeployment() {
  try {
    const deployments = await dokploy(
      `deployment.allByCompose?composeId=${encodeURIComponent(DOKPLOY_COMPOSE_ID)}`,
    );

    if (!Array.isArray(deployments) || deployments.length === 0) {
      console.error("[nando] nessun deployment Dokploy trovato per questo compose.");
      return;
    }

    const latest = deployments.toSorted(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    )[0];

    console.error(
      `[nando] ultimo deployment Dokploy: ${latest.status ?? "sconosciuto"} ` +
        `(${latest.title ?? "senza titolo"}), creato ${latest.createdAt ?? "?"}`,
    );

    if (latest.errorMessage) {
      console.error(`[nando] errore riportato da Dokploy: ${latest.errorMessage}`);
    }

    if (latest.logPath) {
      console.error(`[nando] log del deployment sulla VPS: sudo tail -n 200 ${latest.logPath}`);
    }
  } catch (error) {
    console.error(
      `[nando] stato del deployment non disponibile: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}

async function main() {
  const compose = await dokploy(`compose.one?composeId=${encodeURIComponent(DOKPLOY_COMPOSE_ID)}`);
  const env = replaceImageTag(compose.env ?? "", IMAGE_TAG);

  await dokploy("compose.update", {
    method: "POST",
    body: JSON.stringify({ composeId: DOKPLOY_COMPOSE_ID, env }),
  });

  await dokploy("compose.deploy", {
    method: "POST",
    body: JSON.stringify({
      composeId: DOKPLOY_COMPOSE_ID,
      title: `deploy ${IMAGE_TAG}`,
    }),
  });

  console.log(`[nando] deploy Dokploy avviato per ${IMAGE_TAG}`);

  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      await smoke();
      console.log(`[nando] staging healthy su ${stagingUrl} (${IMAGE_TAG})`);
      return;
    } catch (error) {
      if (attempt === 60) {
        await reportDeployment();
        throw error;
      }
      console.log(
        `[nando] smoke ${attempt}/60 non ancora pronto: ${
          error instanceof Error ? error.message : error
        }`,
      );
      await sleep(10_000);
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
