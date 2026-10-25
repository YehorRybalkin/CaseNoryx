"use client";

import { BarChartView, ChartCard, LineChartView, RadarChartView } from "@/components/charts/charts";
import { EmptyState } from "@/components/ui/misc";

export function ScoreProgression({ timeline }: { timeline: { label: string; overall: number | null; objective: number; caseId: string; date: string }[] }) {
  if (timeline.length === 0) return <ChartCard title="Score progression" description="Scores of each evaluated submission"><EmptyState title="No evaluations yet" description="Submit a case recommendation to start your score history." /></ChartCard>;
  const data = timeline.map((t) => ({ ...t, overall: t.overall === null ? null : t.overall / 100, objective: t.objective / 100 }));
  return (
    <ChartCard
      title="Score progression"
      description="Objective score (55 rubric points) and overall score where all dimensions were assessed"
      table={{ columns: [{ key: "label", label: "#" }, { key: "date", label: "Date" }, { key: "caseId", label: "Case" }, { key: "objective", label: "Objective", format: "percent" }, { key: "overall", label: "Overall", format: "percent" }], rows: data }}
    >
      <LineChartView data={data} xKey="label" format="percent" series={[{ key: "objective", label: "Objective score" }, { key: "overall", label: "Overall score" }]} />
    </ChartCard>
  );
}

export function SkillRadar({ skills }: { skills: { label: string; value: number | null; samples: number }[] }) {
  const SHORT: Record<string, string> = { "Problem structuring": "Structuring", "Analytical accuracy": "Accuracy", "Root-cause diagnosis": "Root cause", "Strategic recommendations": "Recommendations", "Quantification & evidence": "Evidence", "Executive communication": "Communication" };
  const data = skills.filter((s) => s.value !== null).map((s) => ({ skill: SHORT[s.label] ?? s.label, value: s.value as number }));
  return (
    <ChartCard
      title="Consulting skills"
      description="Average % of rubric points; only objectively or AI-assessed dimensions"
      table={{ columns: [{ key: "label", label: "Skill" }, { key: "value", label: "Avg. %", format: "number" }, { key: "samples", label: "Assessments", format: "integer" }], rows: skills }}
    >
      {data.length >= 3 ? <RadarChartView data={data} /> : <EmptyState title="Not enough assessed skills" description="Skills appear after your first evaluated submission. Qualitative skills require AI evaluation." />}
    </ChartCard>
  );
}

export function DifficultyChart({ rows }: { rows: { difficulty: string; objective: number | null; submissions: number }[] }) {
  const has = rows.some((r) => r.submissions > 0);
  const data = rows.map((r) => ({ difficulty: r.difficulty, objective: r.objective === null ? null : r.objective / 100, submissions: r.submissions }));
  return (
    <ChartCard title="Performance by difficulty" description="Average objective score" table={{ columns: [{ key: "difficulty", label: "Difficulty" }, { key: "objective", label: "Avg. objective", format: "percent" }, { key: "submissions", label: "Submissions", format: "integer" }], rows: data }}>
      {has ? <BarChartView data={data} xKey="difficulty" format="percent" series={[{ key: "objective", label: "Avg. objective score" }]} height={220} /> : <EmptyState title="No submissions yet" />}
    </ChartCard>
  );
}
