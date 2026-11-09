import { getWebConfig } from "./config";

const MAX_BODY_BYTES = 10 * 1024 * 1024;

const ALLOWED_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "last-event-id",
  "range",
  "x-request-id",
]);

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

class ProxyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function requestId(): string {
  return crypto.randomUUID();
}

function errorResponse(error: ProxyError): Response {
  return Response.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
      },
      requestId: requestId(),
    },
    { status: error.status },
  );
}

export function assertSameOrigin(request: Request, url: URL): void {
  if (!MUTATION_METHODS.has(request.method)) return;

  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");

  if (origin && origin !== url.origin) {
    throw new ProxyError(403, "forbidden", "Origin non valido.");
  }

  if (site && site !== "same-origin") {
    throw new ProxyError(403, "forbidden", "Richiesta cross-site non consentita.");
  }

  if (!origin && site !== "same-origin") {
    throw new ProxyError(403, "forbidden", "Origin mancante su una mutazione.");
  }
}

export async function proxyApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    if (!url.pathname.startsWith("/api/")) {
      throw new ProxyError(404, "not_found", "Risorsa non trovata.");
    }

    if (url.pathname === "/api/health") {
      throw new ProxyError(404, "not_found", "Risorsa non trovata.");
    }

    assertSameOrigin(request, url);

    const config = getWebConfig();
    const target = new URL(url.pathname + url.search, config.API_URL);

    const headers = new Headers();

    for (const [name, value] of request.headers) {
      if (ALLOWED_REQUEST_HEADERS.has(name.toLowerCase())) {
        headers.set(name, value);
      }
    }

    headers.set("authorization", `Bearer ${config.INTERNAL_TOKEN}`);

    if (!headers.has("x-request-id")) {
      headers.set("x-request-id", requestId());
    }

    let body: ArrayBuffer | undefined;

    if (request.method !== "GET" && request.method !== "HEAD") {
      const contentLength = Number(request.headers.get("content-length") ?? "0");
      if (contentLength > MAX_BODY_BYTES) {
        throw new ProxyError(413, "payload_too_large", "Payload troppo grande.");
      }

      body = await request.arrayBuffer();

      if (body.byteLength > MAX_BODY_BYTES) {
        throw new ProxyError(413, "payload_too_large", "Payload troppo grande.");
      }
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      signal: request.signal,
      redirect: "manual",
    };

    if (body !== undefined) {
      init.body = body;
    }

    const upstream = await fetch(target, init);

    const responseHeaders = new Headers();

    for (const [name, value] of upstream.headers) {
      const lower = name.toLowerCase();
      if (
        HOP_BY_HOP_HEADERS.has(lower) ||
        lower === "content-encoding" ||
        lower === "content-length"
      ) {
        continue;
      }
      responseHeaders.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof ProxyError) {
      return errorResponse(error);
    }

    return errorResponse(new ProxyError(502, "bad_gateway", "api non raggiungibile dal proxy."));
  }
}
