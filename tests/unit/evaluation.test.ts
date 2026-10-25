import { describe, expect, it } from "vitest";
import { withinTolerance } from "@/lib/analytics";
import { CASES, getCase } from "@/lib/cases/registry";
import { extractNumbers } from "@/lib/evaluation/text";
import { EMPTY_RECOMMENDATION, type RecommendationContent } from "@/lib/recommendation";
import { getAnswerKey } from "@/server/answer-keys";
import { deterministicEvaluation, finaliseScores, gradeQuant } from "@/server/evaluation/deterministic";

function modelSubmission(slug: string): RecommendationContent {
  const def = getCase(slug)!;
  const key = getAnswerKey(def.slug);
  return {
    ...key.modelRecommendation,
    selectedDrivers: Object.entries(key.driverClassification).filter(([, v]) => v === "root").map(([k]) => k),
    quantAnswers: Object.fromEntries(Object.entries(key.quantAnswers).map(([k, v]) => [k, v.value])),
  };
}
const hyps = [
  { title: "H1", status: "supported", supporting: "evidence from the data", contradicting: "" },
  { title: "H2", status: "contradicted", supporting: "", contradicting: "data contradicts it clearly" },
  { title: "H3", status: "inconclusive", supporting: "", contradicting: "" },
];

describe("answer keys", () => {
  it("cover every quant question and diagnosis option", () => {
    for (const c of CASES) {
      const k = getAnswerKey(c.slug);
      for (const q of c.quantQuestions) expect(k.quantAnswers[q.id], `${c.slug}.${q.id}`).toBeDefined();
      for (const o of c.diagnosisOptions) expect(k.driverClassification[o.id], `${c.slug}.${o.id}`).toBeDefined();
      for (const r of k.rootCauses) for (const d of r.driverIds) expect(c.diagnosisOptions.some((o) => o.id === d)).toBe(true);
      expect(k.rootCauses.reduce((a, r) => a + r.weight, 0)).toBeCloseTo(1, 6);
      expect(k.recommendationThemes.reduce((a, r) => a + r.weight, 0)).toBeCloseTo(1, 6);
      for (const v of Object.values(k.quantAnswers)) expect(Number.isFinite(v.value)).toBe(true);
    }
  });
  it("model answers are internally consistent with the computed facts", () => {
    for (const c of CASES) {
      const k = getAnswerKey(c.slug);
      const text = Object.values(k.modelRecommendation).join("\n");
      const nums = extractNumbers(text);
      // The model answer must cite several dataset facts correctly
      const cited = k.keyFacts.filter((f) => nums.some((n) => (n.kind === f.kind || f.kind === "plain") && (withinTolerance(n.value, f.value, f.tolerance) || withinTolerance(-n.value, f.value, f.tolerance))));
      expect(cited.length, c.slug).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("deterministic grader", () => {
  it("awards high objective scores to the model answer in every case", () => {
    for (const c of CASES) {
      const r = finaliseScores(deterministicEvaluation(c, getAnswerKey(c.slug), modelSubmission(c.slug), hyps));
      const acc = r.dimensions.find((d) => d.id === "accuracy")!;
      const rc = r.dimensions.find((d) => d.id === "rootCause")!;
      expect(acc.score, c.slug).toBe(25);
      expect(rc.score, c.slug).toBeGreaterThanOrEqual(18);
      expect(r.objectiveScore, c.slug).toBeGreaterThanOrEqual(85);
    }
  });
  it("gives low scores to an empty submission", () => {
    const def = getCase("retail-profitability")!;
    const r = deterministicEvaluation(def, getAnswerKey(def.slug), EMPTY_RECOMMENDATION, []);
    expect(r.objectiveScore).toBe(0);
    expect(r.missedInsights.length).toBe(getAnswerKey(def.slug).rootCauses.length);
  });
  it("never reports an overall score while qualitative dimensions are heuristic", () => {
    const def = getCase("saas-churn")!;
    const r = finaliseScores(deterministicEvaluation(def, getAnswerKey(def.slug), modelSubmission(def.slug), hyps));
    expect(r.overallScore).toBeNull();
    expect(r.dimensions.filter((d) => d.assessed === "indicative").map((d) => d.id).sort()).toEqual(["communication", "recommendations", "structuring"]);
  });
  it("sums dimension scores into the overall score when all are fully assessed", () => {
    const def = getCase("saas-churn")!;
    const base = deterministicEvaluation(def, getAnswerKey(def.slug), modelSubmission(def.slug), hyps);
    const all = finaliseScores({ ...base, dimensions: base.dimensions.map((d) => ({ ...d, assessed: "full" as const })) });
    expect(all.overallScore).toBeCloseTo(base.dimensions.reduce((a, d) => a + d.score, 0), 6);
    for (const d of base.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(d.max);
    }
    expect(base.dimensions.reduce((a, d) => a + d.max, 0)).toBe(100);
    expect(base.objectiveMax).toBe(55);
  });
  it("detects unit errors, close answers and sign slips", () => {
    const def = getCase("retail-profitability")!;
    const key = getAnswerKey(def.slug);
    const gm = key.quantAnswers.grossMargin2024.value;
    const op = key.quantAnswers.opProfitChange.value;
    const res = gradeQuant(def, key, { grossMargin2024: gm / 100, netSalesGrowth: key.quantAnswers.netSalesGrowth.value + 0.5, opProfitChange: -op });
    expect(res.find((q) => q.id === "grossMargin2024")!.status).toBe("unit_error");
    expect(res.find((q) => q.id === "netSalesGrowth")!.status).toBe("close");
    expect(res.find((q) => q.id === "opProfitChange")!.explanation).toMatch(/sign/);
    expect(res.find((q) => q.id === "elecMargin2024")!.status).toBe("missing");
  });
  it("penalises distractor drivers", () => {
    const def = getCase("retail-profitability")!;
    const key = getAnswerKey(def.slug);
    const good = modelSubmission(def.slug);
    const noisy = { ...good, selectedDrivers: [...good.selectedDrivers, "east", "staff"] };
    const a = deterministicEvaluation(def, key, good, hyps).dimensions.find((d) => d.id === "rootCause")!.score;
    const b = deterministicEvaluation(def, key, noisy, hyps).dimensions.find((d) => d.id === "rootCause")!.score;
    expect(b).toBe(a - 5);
  });
  it("does not credit keyword lists without the mechanism in one sentence", () => {
    const def = getCase("retail-profitability")!;
    const key = getAnswerKey(def.slug);
    const stuffed = { ...EMPTY_RECOMMENDATION, diagnosis: "Electronics.\nApparel.\nMargin.\nReturns.\nMix." };
    const r = deterministicEvaluation(def, key, stuffed, []);
    expect(r.rootCauses.filter((x) => x.identifiedInText).length).toBeLessThanOrEqual(1);
  });
});

describe("number extraction", () => {
  it("parses units", () => {
    const n = extractNumbers("Margin fell 5.2pp to 33.3%, OP −€11.9m, CAC €737, ROAS 2.35x, 1,234 units, 420k spend");
    expect(n.find((x) => x.raw.includes("5.2"))).toMatchObject({ kind: "percent", value: 5.2 });
    expect(n.find((x) => x.raw.includes("33.3"))).toMatchObject({ kind: "percent", value: 33.3 });
    expect(n.find((x) => x.raw.includes("11.9"))).toMatchObject({ kind: "eur", value: -11.9 });
    expect(n.find((x) => x.raw.includes("737"))!.kind).toBe("eur");
    expect(n.find((x) => x.raw.includes("2.35"))).toMatchObject({ kind: "ratio", value: 2.35 });
    expect(n.find((x) => x.raw.includes("1,234"))).toMatchObject({ kind: "plain", value: 1234 });
    expect(n.find((x) => x.raw.includes("420"))).toMatchObject({ kind: "eur", value: 0.42 });
  });
});

describe("misquote detection", () => {
  it("does not flag a number that correctly matches another fact", async () => {
    const { factsCited } = await import("@/server/evaluation/deterministic");
    const key = getAnswerKey("retail-profitability");
    const ecost = key.keyFacts.find((f) => f.id === "ecost")!.value;
    const r = factsCited(key, `Electronics unit cost rose ${ecost}% while prices fell.`);
    expect(r.cited.some((c) => c.label === "Electronics unit-cost change")).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
});
