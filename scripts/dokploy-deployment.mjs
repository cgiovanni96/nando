/**
 * Id di un deployment Dokploy; la risposta espone `deploymentId`.
 * @param {Record<string, unknown> | null | undefined} deployment
 * @returns {string | null}
 */
export function deploymentId(deployment) {
  const id = deployment?.deploymentId ?? deployment?.id;

  return typeof id === "string" ? id : null;
}

/**
 * Id dei deployment già presenti: serve a riconoscere quello che abbiamo avviato noi.
 * @param {unknown} deployments
 * @returns {string[]}
 */
export function deploymentIds(deployments) {
  if (!Array.isArray(deployments)) return [];

  return deployments.map(deploymentId).filter((id) => id !== null);
}

/**
 * Il deployment avviato da questo run: il più recente fra quelli che non esistevano
 * prima del trigger e che portano il titolo scelto. Il filtro sugli id noti evita di
 * prendere un deploy precedente con lo stesso tag (rollback o redeploy manuale).
 * @param {unknown} deployments
 * @param {{ knownIds?: string[], title?: string }} [options]
 * @returns {Record<string, unknown> | null}
 */
export function findTriggeredDeployment(deployments, { knownIds = [], title } = {}) {
  if (!Array.isArray(deployments)) return null;

  const known = new Set(knownIds);

  return (
    deployments
      .filter((deployment) => {
        const id = deploymentId(deployment);
        return id !== null && !known.has(id) && deployment?.title === title;
      })
      .toSorted(
        (a, b) =>
          new Date(String(b.createdAt ?? 0)).getTime() -
          new Date(String(a.createdAt ?? 0)).getTime(),
      )[0] ?? null
  );
}

/**
 * Gli stati terminali di Dokploy sono `done`, `error` e `cancelled`.
 * @param {Record<string, unknown> | null | undefined} deployment
 * @returns {"pending" | "done" | "failed"}
 */
export function deploymentState(deployment) {
  const status = typeof deployment?.status === "string" ? deployment.status.toLowerCase() : "";

  if (status === "done") return "done";
  if (status === "error" || status === "cancelled") return "failed";

  return "pending";
}
