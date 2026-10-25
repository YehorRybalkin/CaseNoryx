import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAnswerKey } from "@/server/answer-keys";
import { prisma } from "@/server/db";
import * as svc from "@/server/services";
import { defaultInputs } from "@/lib/simulation";
import { getCase } from "@/lib/cases/registry";
import { EMPTY_RECOMMENDATION } from "@/lib/recommendation";

const SLUG = "retail-profitability";

function goodSubmission() {
  const key = getAnswerKey(SLUG);
  return {
    ...key.modelRecommendation,
    selectedDrivers: ["elec_price", "elec_cost", "mix", "returns", "not_a_real_driver"],
    quantAnswers: { ...Object.fromEntries(Object.entries(key.quantAnswers).map(([k, v]) => [k, v.value])), injected: 5 },
  };
}

beforeAll(async () => {
  await svc.ensureBootstrapped();
  await svc.resetProgress();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("bootstrap & settings", () => {
  it("creates the local profile and the five cases idempotently", async () => {
    await svc.ensureBootstrapped();
    expect(await prisma.userProfile.count()).toBe(1);
    expect(await prisma.consultingCase.count()).toBe(5);
    const s = await svc.getSettings();
    expect(s.coachMode).toBe("guided");
  });
  it("validates and persists settings", async () => {
    await expect(svc.updateSettings({ displayName: "", theme: "dark", coachMode: "guided", aiCoachEnabled: true, aiEvaluationEnabled: true })).rejects.toThrow();
    await svc.updateSettings({ displayName: "Ada", theme: "dark", coachMode: "interview", aiCoachEnabled: false, aiEvaluationEnabled: true });
    expect(await svc.getSettings()).toMatchObject({ displayName: "Ada", theme: "dark", coachMode: "interview", aiCoachEnabled: false });
  });
});

describe("case progress, hypotheses, notes, scenarios", () => {
  it("starts a case once and records the active tab", async () => {
    await svc.touchProgress(SLUG, "data");
    await svc.touchProgress(SLUG, "not-a-tab");
    const p = await svc.getProgress(SLUG);
    expect(p).toMatchObject({ status: "in_progress", lastTab: "data", attempts: 0 });
    expect(await prisma.activityEvent.count({ where: { type: "case_started" } })).toBe(1);
    await expect(svc.touchProgress("unknown-case")).rejects.toThrow(/Unknown case/);
  });
  it("creates, updates and deletes hypotheses with validation", async () => {
    await expect(svc.createHypothesis(SLUG, { title: "x" })).rejects.toThrow();
    const h = await svc.createHypothesis(SLUG, { title: "Electronics discounting compressed margins", supporting: "<script>alert(1)</script>" });
    expect(h.status).toBe("untested");
    expect(h.supporting).toBe("<script>alert(1)</script>"); // stored verbatim, rendered escaped by React
    const u = await svc.updateHypothesis(h.id, { title: h.title, status: "supported", confidence: 80, supporting: "GM 21.6% → 11.0%" });
    expect(u).toMatchObject({ status: "supported", confidence: 80 });
    await expect(svc.updateHypothesis(h.id, { title: h.title, status: "bogus" })).rejects.toThrow();
    await svc.createHypothesis(SLUG, { title: "Apparel returns surged after free returns", status: "supported" });
    await svc.createHypothesis(SLUG, { title: "East region is structurally weak", status: "contradicted", contradicting: "Dip only during refurbishment" });
    const extra = await svc.createHypothesis(SLUG, { title: "Temporary hypothesis to delete" });
    await svc.deleteHypothesis(extra.id);
    expect(await svc.listHypotheses(SLUG)).toHaveLength(3);
  });
  it("stores notes", async () => {
    const n = await svc.createNote(SLUG, "Electronics price dropped in Feb 2024");
    expect((await svc.listNotes(SLUG))[0].id).toBe(n.id);
    await expect(svc.createNote(SLUG, "   ")).rejects.toThrow();
  });
  it("recomputes scenario results on the server and ignores client results", async () => {
    const def = getCase(SLUG)!;
    const saved = await svc.saveScenario(SLUG, { name: "Price +4%", inputs: { ...defaultInputs(def), elecPrice: 4, bogus: 1, mixShift: 500 }, results: { hacked: true } });
    expect(saved.inputs.mixShift).toBe(30); // clamped
    expect(saved.inputs).not.toHaveProperty("bogus");
    expect(saved.results.scenario.operatingProfit).toBeGreaterThan(saved.results.baseline.operatingProfit as number);
    const list = await svc.listScenarios(SLUG);
    expect(list).toHaveLength(1);
    expect(list[0].results).not.toHaveProperty("hacked");
  });
});

describe("recommendation lifecycle", () => {
  it("rejects submission of an incomplete draft", async () => {
    await svc.saveDraft(SLUG, { ...EMPTY_RECOMMENDATION, executiveSummary: "Too short" });
    await expect(svc.submitRecommendation(SLUG)).rejects.toThrow(/Complete all sections/);
  });
  it("sanitises drafts against the case definition", async () => {
    const d = await svc.saveDraft(SLUG, goodSubmission());
    expect(d.content.selectedDrivers).not.toContain("not_a_real_driver");
    expect(d.content.quantAnswers).not.toHaveProperty("injected");
    expect((await svc.getDraft(SLUG))!.content.executiveSummary).toBe(getAnswerKey(SLUG).modelRecommendation.executiveSummary);
  });
  it("submits, locks the snapshot and persists an evaluation without AI", async () => {
    const r = await svc.submitRecommendation(SLUG);
    expect(r.attempt).toBe(1);
    expect(r.report.ai.status).toBe("unavailable");
    expect(r.report.overallScore).toBeNull();
    expect(r.report.objectiveScore).toBeGreaterThanOrEqual(85);
    const p = await svc.getProgress(SLUG);
    expect(p).toMatchObject({ status: "completed", attempts: 1 });
    const subs = await svc.listSubmissions(SLUG);
    expect(subs).toHaveLength(1);
    expect(subs[0].evaluation!.report.modelRecommendation.executiveSummary).toBeTruthy();
    expect(await prisma.performanceHistory.count()).toBe(1);
    // Locked: drafting and re-submitting are refused
    await expect(svc.saveDraft(SLUG, goodSubmission())).rejects.toThrow(/submitted/);
    await expect(svc.submitRecommendation(SLUG)).rejects.toThrow(/already been submitted/);
  });
  it("supports a new attempt while keeping the old snapshot immutable", async () => {
    await svc.startNewAttempt(SLUG);
    await svc.saveDraft(SLUG, { ...goodSubmission(), quantAnswers: {} });
    const r = await svc.submitRecommendation(SLUG);
    expect(r.attempt).toBe(2);
    expect(r.report.dimensions.find((d) => d.id === "accuracy")!.score).toBe(0);
    const subs = await svc.listSubmissions(SLUG);
    expect(subs.map((s) => s.attempt)).toEqual([2, 1]);
    expect(subs[1].content.quantAnswers.netSalesGrowth).toBe(getAnswerKey(SLUG).quantAnswers.netSalesGrowth.value);
    const perf = await svc.getPerformance();
    expect(perf.history).toHaveLength(2);
    expect(perf.history[0].objectiveScore).toBeGreaterThan(perf.history[1].objectiveScore);
  });
  it("persists across a fresh client connection (restart)", async () => {
    await prisma.$disconnect();
    const { PrismaClient } = await import("@prisma/client");
    const fresh = new PrismaClient();
    expect(await fresh.submittedRecommendation.count({ where: { caseId: SLUG } })).toBe(2);
    expect(await fresh.hypothesis.count({ where: { caseId: SLUG } })).toBe(3);
    await fresh.$disconnect();
  });
  it("reset deletes user data but keeps settings and cases", async () => {
    await svc.resetProgress();
    expect(await prisma.submittedRecommendation.count()).toBe(0);
    expect(await prisma.hypothesis.count()).toBe(0);
    expect(await prisma.consultingCase.count()).toBe(5);
    expect((await svc.getSettings()).displayName).toBe("Ada");
  });
});
