import { describe, it, expect } from "vitest";
import {
  environmentConfigSchema,
  parseEnvironmentConfig,
  validateEnvironmentConfig,
} from "@/lib/environment/schema";

const validConfig = {
  version: "1" as const,
  base: "node:20-slim",
  dev: {
    command: "npm run dev",
    port: 3000,
  },
};

describe("environmentConfigSchema", () => {
  // ── Valid configs ──

  it("accepts minimal valid config", () => {
    const result = environmentConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("accepts full config with all optional fields", () => {
    const full = {
      ...validConfig,
      compose: "docker-compose.yml",
      root: "/app",
      setup: ["npm install", "npm run build"],
      dev: { ...validConfig.dev, env: { NODE_ENV: "development" } },
      services: {
        db: {
          image: "postgres:16",
          port: { container: 5432, host: 5433 },
          env: { POSTGRES_PASSWORD: "secret" },
          volumes: ["pgdata:/var/lib/postgresql/data"],
        },
        redis: {
          image: "redis:7",
          port: 6379,
        },
      },
    };
    const result = environmentConfigSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("accepts service with port as number", () => {
    const config = {
      ...validConfig,
      services: { redis: { image: "redis:7", port: 6379 } },
    };
    const result = environmentConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("accepts service with port as PortMapping (host optional)", () => {
    const config = {
      ...validConfig,
      services: { db: { image: "postgres:16", port: { container: 5432 } } },
    };
    const result = environmentConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  // ── Invalid configs ──

  it("rejects missing version", () => {
    const { version, ...rest } = validConfig;
    const result = environmentConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects wrong version value", () => {
    const result = environmentConfigSchema.safeParse({ ...validConfig, version: "2" });
    expect(result.success).toBe(false);
  });

  it("rejects empty base", () => {
    const result = environmentConfigSchema.safeParse({ ...validConfig, base: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing dev", () => {
    const { dev, ...rest } = validConfig;
    const result = environmentConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing dev.command", () => {
    const result = environmentConfigSchema.safeParse({
      ...validConfig,
      dev: { port: 3000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty dev.command", () => {
    const result = environmentConfigSchema.safeParse({
      ...validConfig,
      dev: { command: "", port: 3000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects port out of range (0)", () => {
    const result = environmentConfigSchema.safeParse({
      ...validConfig,
      dev: { command: "npm run dev", port: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects port out of range (65536)", () => {
    const result = environmentConfigSchema.safeParse({
      ...validConfig,
      dev: { command: "npm run dev", port: 65536 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects service with empty image", () => {
    const result = environmentConfigSchema.safeParse({
      ...validConfig,
      services: { db: { image: "" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects service with port container out of range", () => {
    const result = environmentConfigSchema.safeParse({
      ...validConfig,
      services: { db: { image: "postgres:16", port: { container: 0 } } },
    });
    expect(result.success).toBe(false);
  });
});

describe("parseEnvironmentConfig", () => {
  it("returns parsed config for valid input", () => {
    const result = parseEnvironmentConfig(validConfig);
    expect(result.version).toBe("1");
    expect(result.base).toBe("node:20-slim");
    expect(result.dev.command).toBe("npm run dev");
    expect(result.dev.port).toBe(3000);
  });

  it("throws ZodError for invalid input", () => {
    expect(() => parseEnvironmentConfig({})).toThrow();
  });

  it("throws for null input", () => {
    expect(() => parseEnvironmentConfig(null)).toThrow();
  });
});

describe("validateEnvironmentConfig", () => {
  it("returns success: true for valid config", () => {
    const result = validateEnvironmentConfig(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe("1");
    }
  });

  it("returns success: false with error message for invalid config", () => {
    const result = validateEnvironmentConfig({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("version");
    }
  });

  it("joins multiple errors with semicolons", () => {
    const result = validateEnvironmentConfig({ version: "2" });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should have errors for version and missing dev/base
      expect(result.error).toContain(";");
    }
  });

  it("includes field path in error messages", () => {
    const result = validateEnvironmentConfig({
      ...validConfig,
      dev: { command: "", port: 3000 },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("dev.command");
    }
  });
});
