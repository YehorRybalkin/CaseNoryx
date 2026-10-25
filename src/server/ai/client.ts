import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "../env";

export type AiErrorCode = "not_configured" | "rate_limited" | "auth" | "timeout" | "network" | "refused" | "invalid_output" | "api_error";

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

/** User-facing message for an AI failure. Never includes secrets or raw provider errors. */
export function describeAiError(code: AiErrorCode): string {
  switch (code) {
    case "not_configured": return "AI is not configured (no ANTHROPIC_API_KEY). Using offline guidance.";
    case "rate_limited": return "The AI service is rate-limiting requests. Please wait a moment and try again.";
    case "auth": return "The configured Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
    case "timeout": return "The AI service did not respond in time.";
    case "network": return "Could not reach the AI service.";
    case "refused": return "The AI service declined this request.";
    case "invalid_output": return "The AI response could not be validated and was discarded.";
    default: return "The AI service returned an error.";
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const e = env();
  if (!e.ANTHROPIC_API_KEY) throw new AiError("not_configured", describeAiError("not_configured"));
  client ??= new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, timeout: e.AI_TIMEOUT_MS, maxRetries: 2 });
  return client;
}

export function aiModel(): string {
  return env().ANTHROPIC_MODEL;
}

/**
 * One structured-output call. The response is validated against `schema`; anything
 * that does not validate is rejected. Server-side refusal fallback is enabled.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  const c = getClient();
  try {
    const res = await c.beta.messages.parse({
      model: aiModel(),
      max_tokens: opts.maxTokens ?? 16_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      messages: opts.messages,
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    });
    if (res.stop_reason === "refusal") throw new AiError("refused", describeAiError("refused"));
    if (res.parsed_output === null || res.parsed_output === undefined) throw new AiError("invalid_output", describeAiError("invalid_output"));
    const check = opts.schema.safeParse(res.parsed_output);
    if (!check.success) throw new AiError("invalid_output", describeAiError("invalid_output"));
    return check.data;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", describeAiError("rate_limited"));
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new AiError("auth", describeAiError("auth"));
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AiError("timeout", describeAiError("timeout"));
    if (err instanceof Anthropic.APIConnectionError) throw new AiError("network", describeAiError("network"));
    if (err instanceof Anthropic.APIError) throw new AiError("api_error", describeAiError("api_error"));
    throw new AiError("invalid_output", describeAiError("invalid_output"));
  }
}

/** Strips control characters and caps length of user-provided text sent to the model. */
export function sanitiseForPrompt(text: string, max = 4000): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}
