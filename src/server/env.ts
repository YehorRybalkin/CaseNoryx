import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ANTHROPIC_API_KEY: z.string().trim().optional().transform((v) => (v ? v : undefined)),
  ANTHROPIC_MODEL: z.string().trim().min(1).default("claude-opus-5-5"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(60_000),
});

let cached: z.infer<typeof EnvSchema> | null = null;

/** Validated server environment. Throws a readable error (without values) when invalid. */
export function env() {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || undefined,
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${fields}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function aiConfigured(): boolean {
  return Boolean(env().ANTHROPIC_API_KEY);
}
