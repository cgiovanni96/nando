import { describe, expect, it } from "vitest";

import { assertSameOrigin, proxyApiRequest } from "./proxy";

const url = new URL("https://nando.example/api/system/echo");

function request(method: string, headers: Record<string, string>): Request {
  return new Request(url, { method, headers });
}

describe("assertSameOrigin", () => {
  it("accepts a mutation with matching origin and sec-fetch-site", () => {
    expect(() =>
      assertSameOrigin(
        request("POST", { origin: url.origin, "sec-fetch-site": "same-origin" }),
        url,
      ),
    ).not.toThrow();
  });

  it("accepts a mutation with a matching origin only", () => {
    expect(() => assertSameOrigin(request("POST", { origin: url.origin }), url)).not.toThrow();
  });

  it("rejects a cross-origin mutation", () => {
    expect(() =>
      assertSameOrigin(
        request("POST", {
          origin: "https://evil.example",
          "sec-fetch-site": "same-origin",
        }),
        url,
      ),
    ).toThrow(/Origin non valido/);
  });

  it("rejects a mutation without an origin", () => {
    expect(() => assertSameOrigin(request("POST", {}), url)).toThrow(/Origin mancante/);
  });

  it("does not check GET requests", () => {
    expect(() => assertSameOrigin(request("GET", {}), url)).not.toThrow();
  });
});

describe("proxyApiRequest", () => {
  it("does not proxy the internal health route", async () => {
    const response = await proxyApiRequest(new Request("http://localhost:3001/api/health"));

    expect(response.status).toBe(404);
  });
});
