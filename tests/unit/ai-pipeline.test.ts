import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMock = vi.fn();
// Plain function stub so a rejected promise is not recorded as a vi.fn failure.
let aiFailure: Error | null = null;
vi.mock("@/server/ai/evaluator", () => ({
  aiQualitativeEvaluation: (...a: unknown[]) => (aiFailure ? Promise.reject(aiFailure) : aiMock(...a)),
  aiModel: () => "test-model",
}));
vi.mock("@/server/env", () => ({ aiConfigured: () => true, env: () => ({ ANTHROPIC_MODEL: "test-model" }) }));

import { getCase } from "@/lib/cases/registry";
import { getAnswerKey } from "@/server/answer-keys";
import { AiError } from "@/server/ai/client";
import { evaluateSubmission } from "@/server/evaluation";

const def = getCase("airline-route")!;
const key = getAnswerKey(def.slug);
const content = {
  ...key.modelRecommendation,
  selectedDrivers: ["winter_losses", "be_above_forecast", "demand_risk"],
  quantAnswers: Object.fromEntries(Object.entries(key.quantAnswers).map(([k, v]) => [k, v.value])),
};
const dim = (score: number) => ({ score, rationale: "r", evidence: ["quoted text"] });

describe("evaluation pipeline with AI", () => {
  beforeEach(() => {
    aiMock.mockReset();
    aiFailure = null;
  });

  it("uses AI only for qualitative dimensions, clamps scores and computes an overall score", async () => {
    aiMock.mockImplementation(async () => ({ structuring: dim(15), recommendations: dim(17), communication: dim(0), strengths: ["s"], weaknesses: [], improvements: [], summary: "ok" }));
    const r = await evaluateSubmission(def, content, [], { aiEnabled: true });
    expect(r.ai.status).toBe("used");
    const byId = Object.fromEntries(r.dimensions.map((d) => [d.id, d]));
    expect(byId.accuracy.method).toBe("objective");
    expect(byId.accuracy.score).toBe(25);
    expect(byId.structuring.method).toBe("ai");
    expect(byId.structuring.explanation).toMatch(/^AI-generated/);
    expect(r.overallScore).toBeCloseTo(r.dimensions.reduce((a, d) => a + d.score, 0), 6);
    expect(r.strengths.some((s) => s.startsWith("[AI]"))).toBe(true);
  });

  it("falls back to the limited deterministic report when AI fails", async () => {
    aiFailure = new AiError("rate_limited", "The AI service is rate-limiting requests.");
    const r = await evaluateSubmission(def, content, [], { aiEnabled: true });
    expect(r.ai.status).toBe("failed");
    expect(r.ai.message).toMatch(/rate-limiting/);
    expect(r.overallScore).toBeNull();
    expect(r.dimensions.find((d) => d.id === "structuring")!.assessed).toBe("indicative");
  });

  it("does not call AI when disabled in settings", async () => {
    const r = await evaluateSubmission(def, content, [], { aiEnabled: false });
    expect(aiMock).not.toHaveBeenCalled();
    expect(r.ai.status).toBe("disabled");
  });
});

describe("AI evaluator output clamping", () => {
  it("clamps model scores into rubric bounds", async () => {
    vi.resetModules();
    vi.doMock("@/server/ai/client", async (orig) => ({
      ...(await orig<typeof import("@/server/ai/client")>()),
      structuredCall: async () => ({ structuring: dim(99), recommendations: dim(-3), communication: dim(7.3), strengths: [], weaknesses: [], improvements: [], summary: "" }),
    }));
    vi.doUnmock("@/server/ai/evaluator");
    const { aiQualitativeEvaluation } = await import("@/server/ai/evaluator");
    const { deterministicEvaluation } = await import("@/server/evaluation/deterministic");
    const out = await aiQualitativeEvaluation(def, key, content, [], deterministicEvaluation(def, key, content, []));
    expect(out.structuring.score).toBe(15);
    expect(out.recommendations.score).toBe(0);
    expect(out.communication.score).toBe(7.5);
  });
});
