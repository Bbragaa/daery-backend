// config/env.ts valida as variáveis na importação; cada teste carrega o módulo de novo.
const ORIGINAL_ENV = { ...process.env };

function loadEnv(overrides: Record<string, string>) {
  process.env = { ...ORIGINAL_ENV, ...overrides };
  let loaded: typeof import("../../config/env") | undefined;
  jest.isolateModules(() => {
    loaded = require("../../config/env");
  });
  return loaded!.env;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

const EXAMPLE_SECRET = "change-me-to-a-long-random-string";

describe("JWT_SECRET", () => {
  it("rejects the .env.example value in production", () => {
    expect(() => loadEnv({ NODE_ENV: "production", JWT_SECRET: EXAMPLE_SECRET })).toThrow(/example value/);
  });

  it("only warns about the example value in development", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(loadEnv({ NODE_ENV: "development", JWT_SECRET: EXAMPLE_SECRET }).JWT_SECRET).toBe(EXAMPLE_SECRET);
    expect(warn).toHaveBeenCalled();
  });

  it("accepts a random secret in production", () => {
    const secret = "a8f3c9e1b7d24f6a9c0e5b3d7f1a2c4e6b8d0f2a4c6e8";
    expect(loadEnv({ NODE_ENV: "production", JWT_SECRET: secret }).JWT_SECRET).toBe(secret);
  });
});

describe("TRUST_PROXY", () => {
  it("defaults to 0 (no proxy)", () => {
    const { TRUST_PROXY: _ignored, ...rest } = ORIGINAL_ENV;
    process.env = rest;
    let loaded: typeof import("../../config/env") | undefined;
    jest.isolateModules(() => {
      loaded = require("../../config/env");
    });
    expect(loaded!.env.TRUST_PROXY).toBe(0);
  });

  it("accepts the number of proxy hops", () => {
    expect(loadEnv({ TRUST_PROXY: "1" }).TRUST_PROXY).toBe(1);
  });
});
