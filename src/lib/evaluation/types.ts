/** Shape of a stored evaluation report (JSON in Evaluation.report). */
export type DimensionId = "structuring" | "accuracy" | "rootCause" | "recommendations" | "quantification" | "communication";
export type AssessmentMethod = "objective" | "ai" | "heuristic";

export interface Criterion {
  label: string;
  met: boolean | null;
  detail?: string;
  points?: number;
  maxPoints?: number;
}

export interface DimensionResult {
  id: DimensionId;
  label: string;
  max: number;
  score: number;
  method: AssessmentMethod;
  /** "full" = counted in the overall score; "indicative" = heuristic only, not counted. */
  assessed: "full" | "indicative";
  criteria: Criterion[];
  explanation: string;
  /** Evidence quoted by the AI evaluator, if used. */
  evidence?: string[];
}

export interface QuantResult {
  id: string;
  prompt: string;
  unit: string;
  submitted: number | null;
  expected: number;
  status: "correct" | "close" | "incorrect" | "missing" | "unit_error";
  explanation: string;
}

export interface EvaluationReport {
  version: 1;
  dimensions: DimensionResult[];
  overallScore: number | null;
  objectiveScore: number;
  objectivePoints: number;
  objectiveMax: number;
  quantResults: QuantResult[];
  drivers: { id: string; label: string; selected: boolean; classification: "root" | "contributing" | "distractor" }[];
  rootCauses: { id: string; title: string; explanation: string; identifiedInText: boolean; identifiedInDrivers: boolean }[];
  factsCited: { label: string; cited: string }[];
  strengths: string[];
  weaknesses: string[];
  missedInsights: string[];
  quantitativeErrors: string[];
  improvements: string[];
  ai: { status: "used" | "unavailable" | "disabled" | "failed"; model?: string; summary?: string; message?: string };
  modelRecommendation: Record<string, string>;
  commonMistakes: string[];
  alternativeInterpretations: string[];
  limitations: string[];
}

export const DIMENSION_META: Record<DimensionId, { label: string; max: number; criteria: string }> = {
  structuring: { label: "Problem structuring", max: 15, criteria: "Hypothesis-driven approach: explicit, tested hypotheses with evidence; diagnosis covers the relevant driver areas in a MECE way." },
  accuracy: { label: "Analytical accuracy", max: 25, criteria: "Case KPI answers within numerical tolerance and in the requested units." },
  rootCause: { label: "Root-cause diagnosis", max: 20, criteria: "Identifies the dataset-supported root causes, avoids distractors, and explains each mechanism." },
  recommendations: { label: "Strategic recommendations", max: 20, criteria: "Actions address the root causes, are specific, prioritised, risk-aware and avoid value-destroying moves." },
  quantification: { label: "Quantification & evidence", max: 10, criteria: "Cites correct figures from the datasets, with units, to support each claim." },
  communication: { label: "Executive communication", max: 10, criteria: "Answer-first, concise, quantified executive summary with a clear structure." },
};
export const OBJECTIVE_DIMENSIONS: DimensionId[] = ["accuracy", "rootCause", "quantification"];
