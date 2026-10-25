import "server-only";
import type { CaseDefinition } from "@/lib/cases/types";
import type { EvaluationReport } from "@/lib/evaluation/types";
import type { RecommendationContent } from "@/lib/recommendation";
import { AiError, describeAiError } from "../ai/client";
import { aiModel, aiQualitativeEvaluation } from "../ai/evaluator";
import { getAnswerKey } from "../answer-keys";
import { aiConfigured } from "../env";
import { deterministicEvaluation, finaliseScores, type HypothesisInput } from "./deterministic";

/**
 * Full evaluation pipeline: deterministic objective grading always runs; the AI
 * qualitative assessment runs only when configured and enabled, and can only
 * set the three qualitative dimensions (within rubric bounds).
 */
export async function evaluateSubmission(
  def: CaseDefinition,
  content: RecommendationContent,
  hypotheses: HypothesisInput[],
  opts: { aiEnabled: boolean },
): Promise<EvaluationReport> {
  const key = getAnswerKey(def.slug);
  const report = deterministicEvaluation(def, key, content, hypotheses);
  if (!opts.aiEnabled) return finaliseScores({ ...report, ai: { status: "disabled", message: "AI evaluation is turned off in Settings." } });
  if (!aiConfigured()) return finaliseScores({ ...report, ai: { status: "unavailable", message: describeAiError("not_configured") } });
  try {
    const ai = await aiQualitativeEvaluation(def, key, content, hypotheses, report);
    const dims = report.dimensions.map((d) => {
      if (d.id !== "structuring" && d.id !== "recommendations" && d.id !== "communication") return d;
      const a = ai[d.id];
      return { ...d, score: a.score, method: "ai" as const, assessed: "full" as const, explanation: `AI-generated assessment: ${a.rationale}`, evidence: a.evidence };
    });
    return finaliseScores({
      ...report,
      dimensions: dims,
      strengths: [...report.strengths, ...ai.strengths.map((s) => `[AI] ${s}`)],
      weaknesses: [...report.weaknesses, ...ai.weaknesses.map((s) => `[AI] ${s}`)],
      improvements: [...report.improvements, ...ai.improvements.map((s) => `[AI] ${s}`)],
      ai: { status: "used", model: aiModel(), summary: ai.summary },
      limitations: [
        "Analytical accuracy, root-cause diagnosis and quantification are graded objectively against the case answer key.",
        "Problem structuring, strategic recommendations and executive communication were assessed by an AI model against the rubric and the answer key. AI assessments can be wrong; they are clearly marked.",
      ],
    });
  } catch (err) {
    const message = err instanceof AiError ? err.message : describeAiError("api_error");
    return finaliseScores({ ...report, ai: { status: "failed", message } });
  }
}
