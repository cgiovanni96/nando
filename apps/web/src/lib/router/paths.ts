import type { FileRouteTypes } from "@web/routeTree.gen";

/**
 * A destination a page can link to: generated file routes only.
 * Infrastructure and parameterised paths are excluded, because they are not
 * navigable sections and would force `params` on `<Link>`.
 */
export type AppPath = Exclude<FileRouteTypes["to"], "/healthz" | `${string}$${string}`>;
