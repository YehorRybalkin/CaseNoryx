import type { ConceptGroups } from "@/lib/evaluation/text";
import type { CaseSlug } from "@/lib/cases/types";

export interface RootCauseKey {
  id: string;
  title: string;
  explanation: string;
  evidence: string[];
  /** Diagnosis options that correspond to this root cause. */
  driverIds: string[];
  /** Sentence-level concept groups that must co-occur to credit the narrative. */
  concepts: ConceptGroups;
  weight: number;
}

export interface QuantAnswerKey {
  value: number;
  tolerance: { abs?: number; rel?: number };
  explanation: string;
}

export interface KeyFact {
  id: string;
  label: string;
  /** Value in the unit used by text extraction: percent units, EUR millions, ratio, plain. */
  value: number;
  kind: "percent" | "eur" | "ratio" | "plain";
  tolerance: { abs?: number; rel?: number };
}

export interface RecommendationTheme {
  id: string;
  title: string;
  concepts: ConceptGroups;
  weight: number;
}

export interface AntiPattern {
  id: string;
  description: string;
  concepts: ConceptGroups;
}

export interface HintTopic {
  id: string;
  /** Lower-case stems that route a learner question to this topic. */
  triggers: string[];
  /** Socratic question for interview mode. */
  question: string;
  /** Progressive hints for guided mode (weakest first). */
  hints: string[];
  /** Method explanation for learning mode. */
  method: string;
}

export interface RecommendationText {
  executiveSummary: string;
  diagnosis: string;
  rootCauses: string;
  quantitativeEvidence: string;
  recommendedActions: string;
  financialImpact: string;
  implementationPriorities: string;
  risks: string;
}

export interface AnswerKey {
  slug: CaseSlug;
  mainProblem: string;
  rootCauses: RootCauseKey[];
  driverClassification: Record<string, "root" | "contributing" | "distractor">;
  quantAnswers: Record<string, QuantAnswerKey>;
  keyFacts: KeyFact[];
  recommendationThemes: RecommendationTheme[];
  antiPatterns: AntiPattern[];
  alternativeInterpretations: string[];
  commonMistakes: string[];
  modelRecommendation: RecommendationText;
  hintTopics: HintTopic[];
}
