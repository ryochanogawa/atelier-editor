import { z } from "zod";
import type { EnvironmentConfig } from "./types";

const portMappingSchema = z.object({
  container: z.number().int().min(1).max(65535),
  host: z.number().int().min(1).max(65535).optional(),
});

const serviceConfigSchema = z.object({
  image: z.string().min(1),
  port: z.union([z.number().int().min(1).max(65535), portMappingSchema]).optional(),
  env: z.record(z.string(), z.string()).optional(),
  volumes: z.array(z.string()).optional(),
});

export const environmentConfigSchema = z.object({
  version: z.literal("1"),
  base: z.string().min(1),
  compose: z.string().optional(),
  root: z.string().optional(),
  setup: z.array(z.string()).optional(),
  dev: z.object({
    command: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    env: z.record(z.string(), z.string()).optional(),
  }),
  services: z.record(z.string(), serviceConfigSchema).optional(),
});

export function parseEnvironmentConfig(data: unknown): EnvironmentConfig {
  return environmentConfigSchema.parse(data) as EnvironmentConfig;
}

export function validateEnvironmentConfig(
  data: unknown
): { success: true; data: EnvironmentConfig } | { success: false; error: string } {
  const result = environmentConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as EnvironmentConfig };
  }
  const messages = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
  return { success: false, error: messages.join("; ") };
}
