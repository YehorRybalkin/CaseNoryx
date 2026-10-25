/** Pure aggregation of persisted performance history (no fabricated data). */
import { DIMENSION_META, type DimensionId } from "./evaluation/types";

export interface HistoryRow {
  caseId: string;
  attempt: number;
  difficulty: string;
  overallScore: number | null;
  objectiveScore: number;
  createdAt: Date | string;
  dimensions: Record<string, { score: number; max: number; method: string; assessed: string }>;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function performanceStats(history: HistoryRow[]) {
  const overall = history.map((h) => h.overallScore).filter((x): x is number => x !== null);
  const dimIds = Object.keys(DIMENSION_META) as DimensionId[];
  /** Skill level in % of max, using only fully assessed (objective or AI) dimension scores. */
  const skills = dimIds.map((id) => {
    const vals = history.map((h) => h.dimensions[id]).filter((d) => d && d.assessed === "full").map((d) => (d.score / d.max) * 100);
    return { id, label: DIMENSION_META[id].label, value: avg(vals), samples: vals.length };
  });
  const assessed = skills.filter((s) => s.value !== null) as { id: DimensionId; label: string; value: number; samples: number }[];
  const sorted = [...assessed].sort((a, b) => b.value - a.value);
  const timeline = history.map((h, i) => ({
    index: i + 1,
    label: `#${i + 1}`,
    caseId: h.caseId,
    date: new Date(h.createdAt).toISOString().slice(0, 10),
    overall: h.overallScore,
    objective: h.objectiveScore,
  }));
  const byDifficulty = ["Beginner", "Intermediate", "Advanced"].map((d) => {
    const rows = history.filter((h) => h.difficulty === d);
    return { difficulty: d, objective: avg(rows.map((r) => r.objectiveScore)), overall: avg(rows.map((r) => r.overallScore).filter((x): x is number => x !== null)), submissions: rows.length };
  });
  const byCase = [...new Set(history.map((h) => h.caseId))].map((caseId) => {
    const rows = history.filter((h) => h.caseId === caseId);
    const best = Math.max(...rows.map((r) => r.objectiveScore));
    return { caseId, attempts: rows.length, bestObjective: best, latestObjective: rows[rows.length - 1].objectiveScore, firstObjective: rows[0].objectiveScore };
  });
  // Trend: average change between consecutive attempts of the same case, and first→last half comparison
  const deltas = byCase.filter((c) => c.attempts > 1).map((c) => c.latestObjective - c.firstObjective);
  const half = Math.floor(history.length / 2);
  const trend =
    history.length >= 2
      ? (avg(history.slice(half).map((h) => h.objectiveScore)) ?? 0) - (avg(history.slice(0, Math.max(1, half)).map((h) => h.objectiveScore)) ?? 0)
      : null;
  return {
    submissions: history.length,
    averageOverall: avg(overall),
    overallCount: overall.length,
    averageObjective: avg(history.map((h) => h.objectiveScore)),
    analyticalAccuracy: skills.find((s) => s.id === "accuracy")?.value ?? null,
    skills,
    strongest: sorted[0] ?? null,
    weakest: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    timeline,
    byDifficulty,
    byCase,
    retryImprovement: avg(deltas),
    trend,
  };
}
