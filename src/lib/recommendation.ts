import { z } from "zod";

export const MAX_SECTION_CHARS = 6000;

const section = z.string().max(MAX_SECTION_CHARS).default("");

export const RecommendationSchema = z.object({
  executiveSummary: section,
  diagnosis: section,
  rootCauses: section,
  quantitativeEvidence: section,
  recommendedActions: section,
  financialImpact: section,
  implementationPriorities: section,
  risks: section,
  selectedDrivers: z.array(z.string().max(64)).max(20).default([]),
  quantAnswers: z.record(z.string().max(64), z.number().finite().nullable()).default({}),
});
export type RecommendationContent = z.infer<typeof RecommendationSchema>;

export const EMPTY_RECOMMENDATION: RecommendationContent = {
  executiveSummary: "",
  diagnosis: "",
  rootCauses: "",
  quantitativeEvidence: "",
  recommendedActions: "",
  financialImpact: "",
  implementationPriorities: "",
  risks: "",
  selectedDrivers: [],
  quantAnswers: {},
};

export type TextSectionKey = Exclude<keyof RecommendationContent, "selectedDrivers" | "quantAnswers">;

export const RECOMMENDATION_SECTIONS: { key: TextSectionKey; label: string; help: string; rows: number }[] = [
  { key: "executiveSummary", label: "1. Executive summary", help: "Answer first: the decision, the core reason and the quantified impact in 3–5 sentences.", rows: 5 },
  { key: "diagnosis", label: "2. Main diagnosis", help: "What is really going on? Summarise the problem in business terms.", rows: 4 },
  { key: "rootCauses", label: "3. Root causes", help: "One root cause per line, each with its mechanism.", rows: 5 },
  { key: "quantitativeEvidence", label: "4. Quantitative evidence", help: "Key numbers from the data that prove each root cause (with units).", rows: 5 },
  { key: "recommendedActions", label: "5. Recommended actions", help: "Specific, prioritised actions. One per line.", rows: 5 },
  { key: "financialImpact", label: "6. Financial impact", help: "Expected impact, ideally tested in the scenario simulator.", rows: 3 },
  { key: "implementationPriorities", label: "7. Implementation priorities", help: "Sequencing: quick wins, medium term, enablers.", rows: 3 },
  { key: "risks", label: "8. Risks and limitations", help: "What could go wrong, what the data cannot tell you, and mitigations.", rows: 3 },
];

export function isSubmittable(c: RecommendationContent): { ok: boolean; missing: string[] } {
  const missing = RECOMMENDATION_SECTIONS.filter((s) => c[s.key].trim().length < 15).map((s) => s.label);
  return { ok: missing.length === 0, missing };
}
