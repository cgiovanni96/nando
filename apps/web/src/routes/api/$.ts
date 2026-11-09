import { createFileRoute } from "@tanstack/react-router";

import { proxyApiRequest } from "../../server/proxy";

const proxy = ({ request }: { request: Request }) => proxyApiRequest(request);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      PATCH: proxy,
      DELETE: proxy,
      OPTIONS: proxy,
      HEAD: proxy,
    },
  },
});
