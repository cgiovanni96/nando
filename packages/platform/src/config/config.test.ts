import { describe, expect, it } from "vitest";

import {
  ConfigError,
  parseApiConfig,
  parseMigrateConfig,
  parseSeedConfig,
  parseWebConfig,
  parseWorkerConfig,
} from "./config";

const validEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://nando:nando@127.0.0.1:5432/nando_test",
  OWNER_USER_ID: "0199a4c2-7a10-7000-8000-000000000001",
  INTERNAL_TOKEN: "0123456789abcdef0123456789abcdef",
  API_URL: "http://127.0.0.1:3000",
  PORT: "3000",
  DOCS_ENABLED: "true",
};

describe("parseApiConfig", () => {
  it("parses a complete api environment", () => {
    expect(parseApiConfig(validEnv)).toEqual({
      NODE_ENV: "test",
      DATABASE_URL: validEnv.DATABASE_URL,
      OWNER_USER_ID: validEnv.OWNER_USER_ID,
      INTERNAL_TOKEN: validEnv.INTERNAL_TOKEN,
      DOCS_ENABLED: true,
      PORT: 3000,
    });
  });

  it("defaults docs to disabled and port to 3000", () => {
    const config = parseApiConfig({
      DATABASE_URL: validEnv.DATABASE_URL,
      OWNER_USER_ID: validEnv.OWNER_USER_ID,
      INTERNAL_TOKEN: validEnv.INTERNAL_TOKEN,
    });

    expect(config.DOCS_ENABLED).toBe(false);
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe("development");
  });

  it("fails with an actionable message when the owner is missing", () => {
    expect(() =>
      parseApiConfig({
        DATABASE_URL: validEnv.DATABASE_URL,
        INTERNAL_TOKEN: validEnv.INTERNAL_TOKEN,
      }),
    ).toThrow(ConfigError);

    expect(() =>
      parseApiConfig({
        DATABASE_URL: validEnv.DATABASE_URL,
        INTERNAL_TOKEN: validEnv.INTERNAL_TOKEN,
      }),
    ).toThrow(/OWNER_USER_ID/);
  });
});

describe("parseWorkerConfig", () => {
  it("parses only the worker keys", () => {
    expect(parseWorkerConfig(validEnv)).toEqual({
      NODE_ENV: "test",
      DATABASE_URL: validEnv.DATABASE_URL,
      OWNER_USER_ID: validEnv.OWNER_USER_ID,
    });
  });
});

describe("parseMigrateConfig", () => {
  it("does not require the owner", () => {
    expect(
      parseMigrateConfig({
        DATABASE_URL: validEnv.DATABASE_URL,
      }),
    ).toEqual({
      NODE_ENV: "development",
      DATABASE_URL: validEnv.DATABASE_URL,
    });
  });
});

describe("parseSeedConfig", () => {
  it("parses the seed keys", () => {
    expect(parseSeedConfig(validEnv)).toEqual({
      NODE_ENV: "test",
      DATABASE_URL: validEnv.DATABASE_URL,
      OWNER_USER_ID: validEnv.OWNER_USER_ID,
    });
  });
});

describe("parseWebConfig", () => {
  it("never exposes DATABASE_URL to web", () => {
    const config = parseWebConfig(validEnv);

    expect(config).toEqual({
      NODE_ENV: "test",
      API_URL: validEnv.API_URL,
      INTERNAL_TOKEN: validEnv.INTERNAL_TOKEN,
      PORT: 3000,
    });
    expect("DATABASE_URL" in config).toBe(false);
  });
});
