import "server-only";
import { round, withinTolerance } from "@/lib/analytics";
import type { CaseDefinition } from "@/lib/cases/types";
import { DIMENSION_META, type Criterion, type DimensionResult, type EvaluationReport, type QuantResult } from "@/lib/evaluation/types";
import { extractNumbers, findConcept, normalise, sentences, wordCount } from "@/lib/evaluation/text";
import type { RecommendationContent } from "@/lib/recommendation";
import type { AnswerKey } from "../answer-keys/types";

export interface HypothesisInput {
  title: string;
  status: string;
  supporting: string;
  contradicting: string;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r1 = (x: number) => round(x, 1);

/** Grades KPI answers. Detects common unit slips (fraction vs percent, EUR vs EUR m). */
export function gradeQuant(def: CaseDefinition, key: AnswerKey, answers: RecommendationContent["quantAnswers"]): QuantResult[] {
  return def.quantQuestions.map((q) => {
    const k = key.quantAnswers[q.id];
    const submitted = answers[q.id] ?? null;
    const base = { id: q.id, prompt: q.prompt, unit: q.unit, submitted, expected: k.value, explanation: k.explanation };
    if (submitted === null || !Number.isFinite(submitted)) return { ...base, status: "missing" as const };
    if (withinTolerance(submitted, k.value, k.tolerance)) return { ...base, status: "correct" as const };
    const doubled = { abs: k.tolerance.abs !== undefined ? k.tolerance.abs * 2 : undefined, rel: k.tolerance.rel !== undefined ? k.tolerance.rel * 2 : undefined };
    if (withinTolerance(submitted, k.value, doubled)) return { ...base, status: "close" as const };
    const scales = q.unit === "%" || q.unit === "pp" ? [100, 0.01] : q.unit === "EUR m" ? [1e6, 1e-6, 1000, 0.001] : [];
    for (const s of scales) {
      if (withinTolerance(submitted * s, k.value, { abs: (k.tolerance.abs ?? 0) * 2, rel: (k.tolerance.rel ?? 0) * 2 || 0.02 })) {
        return { ...base, status: "unit_error" as const };
      }
    }
    // Sign slip (e.g. "−11.9" entered as "11.9")
    if (k.value < 0 && withinTolerance(-submitted, k.value, k.tolerance)) return { ...base, status: "incorrect" as const, explanation: `${k.explanation}. Check the sign: a decline should be negative.` };
    return { ...base, status: "incorrect" as const };
  });
}

function allText(c: RecommendationContent): string {
  return [c.executiveSummary, c.diagnosis, c.rootCauses, c.quantitativeEvidence, c.recommendedActions, c.financialImpact, c.implementationPriorities, c.risks].join("\n");
}

export function factsCited(key: AnswerKey, text: string) {
  const nums = extractNumbers(text);
  const cited: { id: string; label: string; cited: string; n: (typeof nums)[number] }[] = [];
  const errors: string[] = [];
  for (const f of key.keyFacts) {
    const hit = nums.find((n) => (n.kind === f.kind || (f.kind === "plain" && n.kind !== "percent")) && (withinTolerance(n.value, f.value, f.tolerance) || withinTolerance(-n.value, f.value, f.tolerance)));
    if (hit) cited.push({ id: f.id, label: f.label, cited: hit.raw, n: hit });
  }
  const used = new Set(cited.map((c) => c.n));
  // Possible misquotes: a number of the same kind that is near — but outside tolerance of — an uncited fact
  for (const n of nums) {
    if (n.kind === "plain" || used.has(n)) continue;
    for (const f of key.keyFacts) {
      if (f.kind !== n.kind || cited.some((c) => c.id === f.id)) continue;
      const tolAbs = f.tolerance.abs ?? Math.abs(f.value) * (f.tolerance.rel ?? 0.02);
      const diff = Math.min(Math.abs(n.value - f.value), Math.abs(-n.value - f.value));
      if (diff > tolAbs && diff <= Math.max(tolAbs * 3, Math.abs(f.value) * 0.08) && Math.abs(f.value) > 0.5) {
        errors.push(`You wrote "${n.raw}" — if this refers to ${f.label.toLowerCase()}, the dataset gives ${f.value}${f.kind === "percent" ? "%" : f.kind === "eur" ? "m EUR" : f.kind === "ratio" ? "x" : ""}.`);
        break;
      }
    }
  }
  return { cited, errors: [...new Set(errors)].slice(0, 6), numbers: nums };
}

export function deterministicEvaluation(def: CaseDefinition, key: AnswerKey, c: RecommendationContent, hypotheses: HypothesisInput[]): EvaluationReport {
  const text = allText(c);
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const missed: string[] = [];
  const improvements: string[] = [];

  // ── Analytical accuracy (objective, 25) ───────────────────────────────
  const quant = gradeQuant(def, key, c.quantAnswers);
  const per = DIMENSION_META.accuracy.max / quant.length;
  const accScore = quant.reduce((a, q) => a + (q.status === "correct" ? per : q.status === "close" ? per / 2 : 0), 0);
  const quantErrors: string[] = quant
    .filter((q) => q.status !== "correct")
    .map((q) =>
      q.status === "missing"
        ? `${q.prompt}: not answered (expected ≈ ${q.expected} ${q.unit}).`
        : q.status === "unit_error"
          ? `${q.prompt}: you entered ${q.submitted}, which looks like a unit error — the answer is ${q.expected} ${q.unit}.`
          : `${q.prompt}: you entered ${q.submitted} ${q.unit}; expected ${q.expected} ${q.unit} (${q.explanation}).`,
    );
  const correct = quant.filter((q) => q.status === "correct");
  if (correct.length >= Math.ceil(quant.length * 0.67)) strengths.push(`Accurate KPI work: ${correct.length} of ${quant.length} calculations within tolerance.`);
  if (correct.length < quant.length / 2) weaknesses.push(`Only ${correct.length} of ${quant.length} KPI calculations were correct; re-check formulas and units.`);
  const accuracy: DimensionResult = {
    id: "accuracy", label: DIMENSION_META.accuracy.label, max: 25, score: r1(accScore), method: "objective", assessed: "full",
    criteria: quant.map((q) => ({ label: q.prompt, met: q.status === "correct" ? true : q.status === "close" ? null : false, detail: q.status === "close" ? "Close but outside tolerance (half credit)" : q.status.replace("_", " "), points: r1(q.status === "correct" ? per : q.status === "close" ? per / 2 : 0), maxPoints: r1(per) })),
    explanation: "Each KPI answer is compared with the value computed from the case datasets. Full credit within tolerance, half credit within twice the tolerance.",
  };

  // ── Root-cause diagnosis (objective, 20) ──────────────────────────────
  const drivers = def.diagnosisOptions.map((o) => ({ id: o.id, label: o.label, selected: c.selectedDrivers.includes(o.id), classification: key.driverClassification[o.id] ?? "distractor" }));
  const rootDrivers = drivers.filter((d) => d.classification === "root");
  const selectedRoot = rootDrivers.filter((d) => d.selected).length;
  const selectedDistractors = drivers.filter((d) => d.selected && d.classification === "distractor");
  const driverPts = clamp(12 * (selectedRoot / Math.max(1, rootDrivers.length)) - 2.5 * selectedDistractors.length, 0, 12);
  const diagnosisText = [c.diagnosis, c.rootCauses, c.executiveSummary, c.quantitativeEvidence].join("\n");
  const rc = key.rootCauses.map((r) => ({
    id: r.id, title: r.title, explanation: r.explanation,
    identifiedInText: findConcept(diagnosisText, r.concepts) !== null,
    identifiedInDrivers: r.driverIds.some((d) => c.selectedDrivers.includes(d)),
    weight: r.weight,
  }));
  const narrativePts = 8 * rc.filter((r) => r.identifiedInText).reduce((a, r) => a + r.weight, 0);
  for (const r of rc) if (!r.identifiedInText && !r.identifiedInDrivers) missed.push(`${r.title}: ${r.explanation}`);
  for (const r of rc) if (!r.identifiedInText && r.identifiedInDrivers) improvements.push(`You flagged "${r.title}" as a driver but did not explain its mechanism in the diagnosis.`);
  for (const d of selectedDistractors) weaknesses.push(`"${d.label}" is not supported by the data as a root cause.`);
  if (rc.every((r) => r.identifiedInText)) strengths.push("The diagnosis explains every major root cause.");
  const rootCause: DimensionResult = {
    id: "rootCause", label: DIMENSION_META.rootCause.label, max: 20, score: r1(driverPts + narrativePts), method: "objective", assessed: "full",
    criteria: [
      { label: `Root-cause drivers selected (${selectedRoot}/${rootDrivers.length})`, met: selectedRoot === rootDrivers.length, points: r1(driverPts), maxPoints: 12, detail: selectedDistractors.length ? `${selectedDistractors.length} distractor(s) selected (−2.5 each)` : undefined },
      ...rc.map((r) => ({ label: `Mechanism explained: ${r.title}`, met: r.identifiedInText, points: r1(r.identifiedInText ? 8 * r.weight : 0), maxPoints: r1(8 * r.weight) }) as Criterion),
    ],
    explanation: "Driver selection is checked against the answer key (root / contributing / distractor). The narrative must state each mechanism — entity and effect in the same sentence.",
  };

  // ── Quantification & evidence (objective, 10) ────────────────────────
  const fc = factsCited(key, text);
  const factPts = 8 * Math.min(1, fc.cited.length / 5);
  const withUnits = fc.numbers.filter((n) => n.kind !== "plain").length;
  const unitPts = fc.numbers.length >= 3 && withUnits / fc.numbers.length >= 0.6 ? 2 : fc.numbers.length >= 3 ? 1 : 0;
  quantErrors.push(...fc.errors);
  if (fc.cited.length >= 5) strengths.push(`Well evidenced: ${fc.cited.length} dataset figures cited correctly.`);
  else improvements.push(`Support each claim with dataset figures (only ${fc.cited.length} key figures were cited correctly; aim for at least 5).`);
  const quantification: DimensionResult = {
    id: "quantification", label: DIMENSION_META.quantification.label, max: 10, score: r1(factPts + unitPts), method: "objective", assessed: "full",
    criteria: [
      { label: `Key dataset figures cited correctly (${fc.cited.length}; 5 for full credit)`, met: fc.cited.length >= 5, points: r1(factPts), maxPoints: 8 },
      { label: "Numbers carry units (%, €, x, pp)", met: unitPts === 2, points: unitPts, maxPoints: 2 },
    ],
    explanation: "Numbers in the submission are extracted with their units and matched to facts computed from the datasets within tolerance.",
  };

  // ── Heuristic indicators (not counted in the overall without AI) ─────
  const testedHyp = hypotheses.filter((h) => h.status !== "untested");
  const withEvidence = hypotheses.filter((h) => (h.supporting + h.contradicting).trim().length > 10);
  const rcLines = c.rootCauses.split(/\n|;|(?:^|\s)\d\)/).map((s) => s.trim()).filter((s) => s.length > 8);
  const sectionsFilled = (["executiveSummary", "diagnosis", "rootCauses", "quantitativeEvidence", "recommendedActions", "financialImpact", "implementationPriorities", "risks"] as const).filter((k) => c[k].trim().length >= 30).length;
  const sCrit: Criterion[] = [
    { label: "At least 3 hypotheses recorded", met: hypotheses.length >= 3, points: hypotheses.length >= 3 ? 4 : Math.min(3, hypotheses.length), maxPoints: 4 },
    { label: "At least 2 hypotheses tested (status set)", met: testedHyp.length >= 2, points: testedHyp.length >= 2 ? 3 : testedHyp.length * 1.5, maxPoints: 3 },
    { label: "Evidence recorded for hypotheses", met: withEvidence.length >= 2, points: withEvidence.length >= 2 ? 3 : withEvidence.length * 1.5, maxPoints: 3 },
    { label: "Root causes listed as distinct items", met: rcLines.length >= 2, points: rcLines.length >= 2 ? 3 : 0, maxPoints: 3 },
    { label: "All eight sections substantively completed", met: sectionsFilled === 8, points: r1((sectionsFilled / 8) * 2), maxPoints: 2 },
  ];
  const structuring: DimensionResult = {
    id: "structuring", label: DIMENSION_META.structuring.label, max: 15, score: r1(sCrit.reduce((a, x) => a + (x.points ?? 0), 0)), method: "heuristic", assessed: "indicative", criteria: sCrit,
    explanation: "Indicative only: measures the structure of your process (hypotheses, testing, evidence, organisation), not the quality of your reasoning.",
  };
  if (hypotheses.length < 3) improvements.push("Work hypothesis-first: record at least three hypotheses and test them against the data before writing the recommendation.");

  const actionsText = [c.recommendedActions, c.executiveSummary, c.implementationPriorities].join("\n");
  const themes = key.recommendationThemes.map((t) => ({ ...t, hit: findConcept(actionsText, t.concepts) !== null }));
  const anti = key.antiPatterns.filter((a) => findConcept(c.recommendedActions + "\n" + c.executiveSummary, a.concepts) !== null);
  const prioritised = /(first|then|next|phase|week|month|quick win|immediate|short[- ]term|medium[- ]term|q[1-4]|priority|1\)|1\.)/i.test(c.implementationPriorities);
  const riskOk = wordCount(c.risks) >= 15;
  const rCrit: Criterion[] = [
    ...themes.map((t) => ({ label: `Addresses: ${t.title}`, met: t.hit, points: r1(t.hit ? 14 * t.weight : 0), maxPoints: r1(14 * t.weight) })),
    { label: "Implementation is sequenced / prioritised", met: prioritised, points: prioritised ? 3 : 0, maxPoints: 3 },
    { label: "Risks and mitigations discussed", met: riskOk, points: riskOk ? 3 : 0, maxPoints: 3 },
    ...anti.map((a) => ({ label: `Value-destroying action proposed: ${a.description}`, met: false, points: -4, maxPoints: 0 })),
  ];
  for (const t of themes.filter((t) => !t.hit && t.weight >= 0.15)) improvements.push(`Consider: ${t.title}.`);
  for (const a of anti) weaknesses.push(a.description);
  const recommendations: DimensionResult = {
    id: "recommendations", label: DIMENSION_META.recommendations.label, max: 20, score: r1(clamp(rCrit.reduce((a, x) => a + (x.points ?? 0), 0), 0, 20)), method: "heuristic", assessed: "indicative", criteria: rCrit,
    explanation: "Indicative only: checks whether actions target the documented root causes and avoid known value-destroying moves. It cannot judge persuasiveness or feasibility.",
  };

  const summaryWords = wordCount(c.executiveSummary);
  const firstSentence = sentences(c.executiveSummary)[0] ?? "";
  const answerFirst = /(recommend|should|must|propose|launch|do not|don't|cut|stop|restore|reallocate|we need|advise|go\b|no-go)/.test(firstSentence) || /(recommend|should|propose)/.test(normalise(c.executiveSummary).slice(0, 220));
  const quantified = extractNumbers(c.executiveSummary).some((n) => n.kind !== "plain");
  const listed = c.recommendedActions.split("\n").filter((l) => l.trim()).length >= 3;
  const cCrit: Criterion[] = [
    { label: "Executive summary is concise (40–200 words)", met: summaryWords >= 40 && summaryWords <= 200, points: summaryWords >= 40 && summaryWords <= 200 ? 3 : summaryWords >= 20 ? 1.5 : 0, maxPoints: 3, detail: `${summaryWords} words` },
    { label: "Summary contains quantified impact", met: quantified, points: quantified ? 3 : 0, maxPoints: 3 },
    { label: "Answer-first: leads with the recommendation", met: answerFirst, points: answerFirst ? 2 : 0, maxPoints: 2 },
    { label: "Actions presented as a clear list", met: listed, points: listed ? 2 : 0, maxPoints: 2 },
  ];
  if (!answerFirst) improvements.push("Lead the executive summary with the answer (the decision or recommendation), then the reasons.");
  if (!quantified) improvements.push("Quantify the executive summary: state the size of the problem and of the prize.");
  const communication: DimensionResult = {
    id: "communication", label: DIMENSION_META.communication.label, max: 10, score: r1(cCrit.reduce((a, x) => a + (x.points ?? 0), 0)), method: "heuristic", assessed: "indicative", criteria: cCrit,
    explanation: "Indicative only: checks form (length, answer-first, quantification, structure), not clarity or persuasiveness.",
  };

  const objectivePoints = accuracy.score + rootCause.score + quantification.score;
  const objectiveMax = 55;
  return {
    version: 1,
    dimensions: [structuring, accuracy, rootCause, recommendations, quantification, communication],
    overallScore: null,
    objectiveScore: r1((objectivePoints / objectiveMax) * 100),
    objectivePoints: r1(objectivePoints),
    objectiveMax,
    quantResults: quant,
    drivers,
    rootCauses: rc.map(({ id, title, explanation, identifiedInText, identifiedInDrivers }) => ({ id, title, explanation, identifiedInText, identifiedInDrivers })),
    factsCited: fc.cited.map(({ label, cited }) => ({ label, cited })),
    strengths: strengths.length ? strengths : ["Submission completed — use the feedback below to sharpen the analysis."],
    weaknesses,
    missedInsights: missed,
    quantitativeErrors: quantErrors,
    improvements: [...new Set(improvements)],
    ai: { status: "unavailable" },
    modelRecommendation: { ...key.modelRecommendation },
    commonMistakes: key.commonMistakes,
    alternativeInterpretations: key.alternativeInterpretations,
    limitations: [
      "Analytical accuracy, root-cause diagnosis and quantification are graded objectively against the case answer key.",
      "Problem structuring, strategic recommendations and executive communication are shown as indicative heuristic indicators only. They are not included in an overall score unless an AI qualitative assessment succeeded.",
    ],
  };
}

/** Recomputes the overall score: only valid when every dimension is fully assessed. */
export function finaliseScores(report: EvaluationReport): EvaluationReport {
  const full = report.dimensions.every((d) => d.assessed === "full");
  return { ...report, overallScore: full ? r1(report.dimensions.reduce((a, d) => a + d.score, 0)) : null };
}
