export const WORKER_MODULE = "worker" as const;

console.log("[nando] worker ready");

const keepAlive = setInterval(() => {
  // Nessun job in M0: il processo resta vivo finché non arriva un segnale.
}, 60_000);

let stopping = false;

function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  clearInterval(keepAlive);
  console.log(`[nando] worker received ${signal}, stopping`);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
