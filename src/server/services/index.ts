import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCase } from "@/lib/cases/registry";
import type { CaseDefinition, CaseSlug } from "@/lib/cases/types";
import type { EvaluationReport } from "@/lib/evaluation/types";
import { EMPTY_RECOMMENDATION, RecommendationSchema, isSubmittable, type RecommendationContent } from "@/lib/recommendation";
import { defaultInputs, normaliseInputs, simulate, type LeverValues } from "@/lib/simulation";
import { prisma } from "../db";
import { evaluateSubmission } from "../evaluation";
import { LOCAL_USER_ID, bootstrapDatabase } from "./bootstrap";

export class ServiceError extends Error {
  constructor(public code: "not_found" | "invalid" | "locked" | "conflict", message: string) {
    super(message);
  }
}

let bootstrapped: Promise<void> | null = null;
/** Ensures the local profile and case catalogue exist (once per process). */
export function ensureBootstrapped() {
  bootstrapped ??= bootstrapDatabase(prisma).catch((e) => {
    bootstrapped = null;
    throw e;
  });
  return bootstrapped;
}

export function requireCase(slug: string): CaseDefinition {
  const def = getCase(slug);
  if (!def) throw new ServiceError("not_found", "Unknown case.");
  return def;
}

async function logActivity(type: string, message: string, caseId?: string, tx: Prisma.TransactionClient = prisma) {
  await tx.activityEvent.create({ data: { type, message, caseId } });
}

// ── Settings ────────────────────────────────────────────────────────────
export const SettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  theme: z.enum(["system", "light", "dark"]),
  coachMode: z.enum(["interview", "guided", "learning"]),
  aiCoachEnabled: z.boolean(),
  aiEvaluationEnabled: z.boolean(),
});
export type SettingsInput = z.infer<typeof SettingsSchema>;

export async function getSettings(): Promise<SettingsInput> {
  await ensureBootstrapped();
  const [p, s] = await Promise.all([
    prisma.userProfile.findUniqueOrThrow({ where: { id: LOCAL_USER_ID } }),
    prisma.userSettings.findUniqueOrThrow({ where: { id: LOCAL_USER_ID } }),
  ]);
  return {
    displayName: p.displayName,
    theme: s.theme as SettingsInput["theme"],
    coachMode: s.coachMode as SettingsInput["coachMode"],
    aiCoachEnabled: s.aiCoachEnabled,
    aiEvaluationEnabled: s.aiEvaluationEnabled,
  };
}

export async function updateSettings(input: unknown): Promise<SettingsInput> {
  const data = SettingsSchema.parse(input);
  await ensureBootstrapped();
  await prisma.$transaction([
    prisma.userProfile.update({ where: { id: LOCAL_USER_ID }, data: { displayName: data.displayName } }),
    prisma.userSettings.update({
      where: { id: LOCAL_USER_ID },
      data: { theme: data.theme, coachMode: data.coachMode, aiCoachEnabled: data.aiCoachEnabled, aiEvaluationEnabled: data.aiEvaluationEnabled },
    }),
  ]);
  return data;
}

// ── Progress ────────────────────────────────────────────────────────────
export const WORKSPACE_TABS = ["brief", "data", "analytics", "hypotheses", "scenario", "recommendation"] as const;

export async function listProgress() {
  await ensureBootstrapped();
  return prisma.caseProgress.findMany();
}

export async function getProgress(slug: CaseSlug) {
  await ensureBootstrapped();
  return prisma.caseProgress.findUnique({ where: { caseId: slug } });
}

/** Marks a case as opened (creates progress on first visit) and records the active tab. */
export async function touchProgress(slug: string, tab?: string) {
  const def = requireCase(slug);
  await ensureBootstrapped();
  const lastTab = tab && (WORKSPACE_TABS as readonly string[]).includes(tab) ? tab : undefined;
  const existing = await prisma.caseProgress.findUnique({ where: { caseId: def.slug } });
  if (!existing) {
    const created = await prisma.caseProgress.create({ data: { caseId: def.slug, lastTab: lastTab ?? "brief" } });
    await logActivity("case_started", `Started “${def.title}”`, def.slug);
    return created;
  }
  return prisma.caseProgress.update({ where: { caseId: def.slug }, data: { lastActivityAt: new Date(), ...(lastTab ? { lastTab } : {}) } });
}

// ── Hypotheses ──────────────────────────────────────────────────────────
export const HypothesisSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(160),
  description: z.string().max(2000).default(""),
  supporting: z.string().max(4000).default(""),
  contradicting: z.string().max(4000).default(""),
  confidence: z.number().int().min(0).max(100).default(50),
  status: z.enum(["untested", "supported", "contradicted", "inconclusive"]).default("untested"),
});
export type HypothesisInput = z.infer<typeof HypothesisSchema>;

export async function listHypotheses(slug: CaseSlug) {
  await ensureBootstrapped();
  return prisma.hypothesis.findMany({ where: { caseId: slug }, orderBy: { createdAt: "asc" } });
}

export async function createHypothesis(slug: string, input: unknown) {
  const def = requireCase(slug);
  const data = HypothesisSchema.parse(input);
  await touchProgress(def.slug);
  const h = await prisma.hypothesis.create({ data: { ...data, caseId: def.slug } });
  await logActivity("hypothesis_created", `Added hypothesis “${data.title}”`, def.slug);
  return h;
}

export async function updateHypothesis(id: string, input: unknown) {
  const data = HypothesisSchema.parse(input);
  const existing = await prisma.hypothesis.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("not_found", "Hypothesis not found.");
  const h = await prisma.hypothesis.update({ where: { id }, data });
  if (existing.status !== data.status) await logActivity("hypothesis_status", `Marked “${data.title}” as ${data.status}`, existing.caseId);
  return h;
}

export async function deleteHypothesis(id: string) {
  const existing = await prisma.hypothesis.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("not_found", "Hypothesis not found.");
  await prisma.hypothesis.delete({ where: { id } });
}

// ── Investigation notes ─────────────────────────────────────────────────
const NoteSchema = z.string().trim().min(1, "Note is empty").max(4000);

export async function listNotes(slug: CaseSlug) {
  await ensureBootstrapped();
  return prisma.investigationNote.findMany({ where: { caseId: slug }, orderBy: { createdAt: "desc" } });
}
export async function createNote(slug: string, content: unknown) {
  const def = requireCase(slug);
  const text = NoteSchema.parse(content);
  await touchProgress(def.slug);
  return prisma.investigationNote.create({ data: { caseId: def.slug, content: text } });
}
export async function deleteNote(id: string) {
  await prisma.investigationNote.delete({ where: { id } }).catch(() => {
    throw new ServiceError("not_found", "Note not found.");
  });
}

// ── Scenarios ───────────────────────────────────────────────────────────
const ScenarioInputSchema = z.object({ name: z.string().trim().min(1).max(80), inputs: z.record(z.string().max(40), z.number().finite()) });

export async function listScenarios(slug: CaseSlug) {
  await ensureBootstrapped();
  const rows = await prisma.savedScenario.findMany({ where: { caseId: slug }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt, inputs: JSON.parse(r.inputs) as LeverValues, results: JSON.parse(r.results) }));
}

/** Results are recomputed on the server; client-supplied results are never trusted. */
export async function saveScenario(slug: string, input: unknown) {
  const def = requireCase(slug);
  const { name, inputs } = ScenarioInputSchema.parse(input);
  const clean = normaliseInputs(def, inputs);
  const result = simulate(def.slug, clean);
  await touchProgress(def.slug);
  const row = await prisma.savedScenario.create({ data: { caseId: def.slug, name, inputs: JSON.stringify(clean), results: JSON.stringify(result) } });
  await logActivity("scenario_saved", `Saved scenario “${name}”`, def.slug);
  return { id: row.id, name: row.name, createdAt: row.createdAt, inputs: clean, results: result };
}

export async function deleteScenario(id: string) {
  await prisma.savedScenario.delete({ where: { id } }).catch(() => {
    throw new ServiceError("not_found", "Scenario not found.");
  });
}

export { defaultInputs };

// ── Recommendations ─────────────────────────────────────────────────────
function parseContent(json: string): RecommendationContent {
  const parsed = RecommendationSchema.safeParse(JSON.parse(json));
  return parsed.success ? parsed.data : EMPTY_RECOMMENDATION;
}

export async function getDraft(slug: CaseSlug) {
  await ensureBootstrapped();
  const d = await prisma.recommendationDraft.findUnique({ where: { caseId: slug } });
  return d ? { content: parseContent(d.content), updatedAt: d.updatedAt } : null;
}

export async function saveDraft(slug: string, input: unknown) {
  const def = requireCase(slug);
  const content = RecommendationSchema.parse(input);
  const known = new Set(def.diagnosisOptions.map((o) => o.id));
  content.selectedDrivers = content.selectedDrivers.filter((d) => known.has(d));
  const qids = new Set(def.quantQuestions.map((q) => q.id));
  content.quantAnswers = Object.fromEntries(Object.entries(content.quantAnswers).filter(([k]) => qids.has(k)));
  const progress = await touchProgress(def.slug);
  if (progress.status !== "in_progress") throw new ServiceError("locked", "This case has been submitted. Start a new attempt to edit your recommendation.");
  const d = await prisma.recommendationDraft.upsert({
    where: { caseId: def.slug },
    update: { content: JSON.stringify(content) },
    create: { caseId: def.slug, content: JSON.stringify(content) },
  });
  return { content, updatedAt: d.updatedAt };
}

export async function submitRecommendation(slug: string) {
  const def = requireCase(slug);
  await ensureBootstrapped();
  const [draft, progress, settings, hypotheses] = await Promise.all([
    prisma.recommendationDraft.findUnique({ where: { caseId: def.slug } }),
    prisma.caseProgress.findUnique({ where: { caseId: def.slug } }),
    prisma.userSettings.findUniqueOrThrow({ where: { id: LOCAL_USER_ID } }),
    prisma.hypothesis.findMany({ where: { caseId: def.slug } }),
  ]);
  if (!draft || !progress) throw new ServiceError("invalid", "Save a draft before submitting.");
  if (progress.status !== "in_progress") throw new ServiceError("locked", "This attempt has already been submitted.");
  const content = parseContent(draft.content);
  const check = isSubmittable(content);
  if (!check.ok) throw new ServiceError("invalid", `Complete all sections before submitting: ${check.missing.join(", ")}.`);

  // 1) Lock the snapshot immediately (immutable record)
  const attempt = progress.attempts + 1;
  const submission = await prisma.$transaction(async (tx) => {
    const s = await tx.submittedRecommendation.create({ data: { caseId: def.slug, attempt, content: JSON.stringify(content) } });
    await tx.caseProgress.update({ where: { caseId: def.slug }, data: { status: "submitted", attempts: attempt, lastActivityAt: new Date() } });
    await logActivity("submitted", `Submitted “${def.title}” (attempt ${attempt})`, def.slug, tx);
    return s;
  });

  // 2) Evaluate (objective always; AI optional) and persist
  const report = await evaluateSubmission(def, content, hypotheses, { aiEnabled: settings.aiEvaluationEnabled });
  await persistEvaluation(def, submission.id, attempt, report);
  return { attempt, report };
}

async function persistEvaluation(def: CaseDefinition, submissionId: string, attempt: number, report: EvaluationReport) {
  await prisma.$transaction(async (tx) => {
    const ev = await tx.evaluation.create({
      data: {
        submissionId,
        overallScore: report.overallScore,
        objectiveScore: report.objectiveScore,
        method: report.ai.status === "used" ? "deterministic+ai" : "deterministic",
        report: JSON.stringify(report),
      },
    });
    await tx.performanceHistory.create({
      data: {
        caseId: def.slug,
        evaluationId: ev.id,
        attempt,
        difficulty: def.difficulty,
        overallScore: report.overallScore,
        objectiveScore: report.objectiveScore,
        dimensions: JSON.stringify(Object.fromEntries(report.dimensions.map((d) => [d.id, { score: d.score, max: d.max, method: d.method, assessed: d.assessed }]))),
      },
    });
    await tx.caseProgress.update({ where: { caseId: def.slug }, data: { status: "completed", completedAt: new Date() } });
    const score = report.overallScore !== null ? `overall ${report.overallScore}/100` : `objective ${report.objectiveScore}%`;
    await logActivity("evaluated", `Evaluation ready for “${def.title}”: ${score}`, def.slug, tx);
  });
}

/** Re-runs evaluation for a submission whose evaluation is missing (e.g. crash mid-way). */
export async function retryEvaluation(slug: string) {
  const def = requireCase(slug);
  const sub = await prisma.submittedRecommendation.findFirst({ where: { caseId: def.slug, evaluation: null }, orderBy: { attempt: "desc" } });
  if (!sub) throw new ServiceError("invalid", "Nothing to evaluate.");
  const [settings, hypotheses] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { id: LOCAL_USER_ID } }),
    prisma.hypothesis.findMany({ where: { caseId: def.slug } }),
  ]);
  const report = await evaluateSubmission(def, parseContent(sub.content), hypotheses, { aiEnabled: settings.aiEvaluationEnabled });
  await persistEvaluation(def, sub.id, sub.attempt, report);
  return { attempt: sub.attempt, report };
}

/** Re-opens the recommendation for a new attempt; previous submissions remain locked. */
export async function startNewAttempt(slug: string) {
  const def = requireCase(slug);
  const p = await prisma.caseProgress.findUnique({ where: { caseId: def.slug } });
  if (!p || p.status !== "completed") throw new ServiceError("invalid", "A new attempt can be started once the current submission has been evaluated.");
  await prisma.caseProgress.update({ where: { caseId: def.slug }, data: { status: "in_progress", lastActivityAt: new Date(), lastTab: "recommendation" } });
  await logActivity("new_attempt", `Started attempt ${p.attempts + 1} of “${def.title}”`, def.slug);
}

export async function listSubmissions(slug: CaseSlug) {
  await ensureBootstrapped();
  const subs = await prisma.submittedRecommendation.findMany({ where: { caseId: slug }, include: { evaluation: true }, orderBy: { attempt: "desc" } });
  return subs.map((s) => ({
    id: s.id,
    attempt: s.attempt,
    submittedAt: s.submittedAt,
    content: parseContent(s.content),
    evaluation: s.evaluation
      ? { overallScore: s.evaluation.overallScore, objectiveScore: s.evaluation.objectiveScore, method: s.evaluation.method, createdAt: s.evaluation.createdAt, report: JSON.parse(s.evaluation.report) as EvaluationReport }
      : null,
  }));
}

// ── Performance & dashboard ────────────────────────────────────────────
export async function getPerformance() {
  await ensureBootstrapped();
  const [history, progress, activity, cases] = await Promise.all([
    prisma.performanceHistory.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.caseProgress.findMany(),
    prisma.activityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.consultingCase.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    history: history.map((h) => ({ ...h, dimensions: JSON.parse(h.dimensions) as Record<string, { score: number; max: number; method: string; assessed: string }> })),
    progress,
    activity,
    cases,
  };
}

/** Deletes all user-generated data (keeps settings and the case catalogue). */
export async function resetProgress() {
  await prisma.$transaction([
    prisma.performanceHistory.deleteMany(),
    prisma.evaluation.deleteMany(),
    prisma.submittedRecommendation.deleteMany(),
    prisma.recommendationDraft.deleteMany(),
    prisma.savedScenario.deleteMany(),
    prisma.hypothesis.deleteMany(),
    prisma.investigationNote.deleteMany(),
    prisma.caseProgress.deleteMany(),
    prisma.activityEvent.deleteMany(),
  ]);
}
