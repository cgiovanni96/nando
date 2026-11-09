export const contractRoutes = [
  { method: "GET", path: "/api/system/info" },
  { method: "POST", path: "/api/system/echo" },
] as const;

export type ContractRoute = (typeof contractRoutes)[number];
