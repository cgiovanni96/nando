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
  { method: "GET", path: "/api/tasks" },
  { method: "POST", path: "/api/tasks" },
  { method: "GET", path: "/api/tasks/{taskId}" },
  { method: "POST", path: "/api/tasks/{taskId}/update" },
  { method: "POST", path: "/api/tasks/{taskId}/complete" },
  { method: "POST", path: "/api/tasks/{taskId}/skip" },
  { method: "POST", path: "/api/tasks/{taskId}/cancel" },
  { method: "POST", path: "/api/tasks/{taskId}/move" },
  { method: "POST", path: "/api/tasks/{taskId}/delete" },
  { method: "POST", path: "/api/tasks/{taskId}/restore" },
] as const;

export type ContractRoute = (typeof contractRoutes)[number];
