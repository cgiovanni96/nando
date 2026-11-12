/**
 * Route del contratto attese nello spec OpenAPI.
 *
 * `docs:check` confronta questo elenco con la spec generata: una route
 * registrata ma assente dalla spec, o viceversa, fa fallire il check.
 */
export const contractRoutes = [
  { method: "GET", path: "/api/system/info" },
  { method: "POST", path: "/api/system/echo" },
  { method: "GET", path: "/api/spaces" },
  { method: "POST", path: "/api/spaces" },
  { method: "GET", path: "/api/spaces/{spaceId}" },
  { method: "POST", path: "/api/spaces/{spaceId}/rename" },
  { method: "POST", path: "/api/spaces/{spaceId}/archive" },
  { method: "POST", path: "/api/spaces/{spaceId}/unarchive" },
  { method: "GET", path: "/api/inbox" },
] as const;

export type ContractRoute = (typeof contractRoutes)[number];
