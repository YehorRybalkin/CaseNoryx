import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DifficultyChart, ScoreProgression, SkillRadar } from "@/components/dashboard/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar, StatTile } from "@/components/ui/misc";
import { CASES, getCase } from "@/lib/cases/registry";
import { fmtDateTime } from "@/lib/format";
import { performanceStats } from "@/lib/performance";
import { getPerformance } from "@/server/services";

export const metadata: Metadata = { title: "Performance Center" };

export default async function PerformancePage() {
  const perf = await getPerformance();
  const stats = performanceStats(perf.history);
  const completed = perf.progress.filter((p) => p.completedAt).length;
  if (stats.submissions === 0) {
    return (
      <div>
        <PageHeader eyebrow="Performance Center" title="Learning analytics" description="Your progress is calculated only from your own evaluated submissions." />
        <EmptyState title="No evaluated submissions yet" description="Complete a case and submit your recommendation to see score history, skills and trends here." action={<Button asChild><Link href="/cases">Choose a case <ArrowRight /></Link></Button>} />
      </div>
    );
  }
  const trendLabel = stats.trend === null ? "—" : `${stats.trend > 0 ? "+" : ""}${stats.trend.toFixed(1)} pts`;
  return (
    <div>
      <PageHeader eyebrow="Performance Center" title="Learning analytics" description="Calculated only from your own evaluated submissions. Qualitative skills appear only where they were assessed by AI." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Completed cases" value={`${completed} / ${CASES.length}`} />
        <StatTile label="Submitted assessments" value={stats.submissions} />
        <StatTile label="Average objective score" value={stats.averageObjective !== null ? `${stats.averageObjective.toFixed(1)}%` : "—"} />
        <StatTile label="Average overall score" value={stats.averageOverall !== null ? stats.averageOverall.toFixed(1) : "—"} sub={stats.averageOverall !== null ? `${stats.overallCount} full evaluation(s)` : "Requires AI evaluation"} />
        <StatTile label="Improvement trend" value={trendLabel} sub="Later vs. earlier half of submissions (objective)" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ScoreProgression timeline={stats.timeline} /></div>
        <SkillRadar skills={stats.skills} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.skills.map((s) => (
              <div key={s.id}>
                <div className="flex justify-between text-xs"><span className="font-medium">{s.label}</span><span className="tabular text-muted-foreground">{s.value === null ? "not assessed" : `${s.value.toFixed(0)}% (${s.samples})`}</span></div>
                <ProgressBar className="mt-1" value={s.value ?? 0} label={s.label} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="rounded-lg bg-success-soft p-2"><div className="text-muted-foreground">Strongest</div><div className="font-medium">{stats.strongest?.label ?? "—"}</div></div>
              <div className="rounded-lg bg-warning-soft p-2"><div className="text-muted-foreground">Weakest</div><div className="font-medium">{stats.weakest?.label ?? "—"}</div></div>
            </div>
          </CardContent>
        </Card>
        <DifficultyChart rows={stats.byDifficulty} />
        <Card>
          <CardHeader><CardTitle>Performance by case</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.byCase.map((c) => {
              const def = getCase(c.caseId);
              return (
                <div key={c.caseId} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{def?.title}</div>
                    <div className="text-xs text-muted-foreground">{c.attempts} attempt(s) · best {c.bestObjective.toFixed(0)}% · latest {c.latestObjective.toFixed(0)}%{c.attempts > 1 ? ` (${c.latestObjective - c.firstObjective >= 0 ? "+" : ""}${(c.latestObjective - c.firstObjective).toFixed(1)})` : ""}</div>
                  </div>
                  <Button asChild size="sm" variant="outline"><Link href={`/cases/${c.caseId}/review`}>Compare</Link></Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle>Submission history</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground"><th className="py-2 text-left font-medium">Date</th><th className="py-2 text-left font-medium">Case</th><th className="py-2 text-left font-medium">Difficulty</th><th className="py-2 text-right font-medium">Attempt</th><th className="py-2 text-right font-medium">Objective</th><th className="py-2 text-right font-medium">Overall</th><th className="py-2 text-right font-medium">Method</th><th /></tr></thead>
              <tbody>
                {[...perf.history].reverse().map((h) => (
                  <tr key={h.id} className="border-t border-border/60">
                    <td className="py-2">{fmtDateTime(h.createdAt)}</td>
                    <td className="py-2">{getCase(h.caseId)?.title}</td>
                    <td className="py-2">{h.difficulty}</td>
                    <td className="py-2 text-right">{h.attempt}</td>
                    <td className="py-2 text-right">{h.objectiveScore.toFixed(1)}%</td>
                    <td className="py-2 text-right">{h.overallScore === null ? "—" : h.overallScore.toFixed(1)}</td>
                    <td className="py-2 text-right">{Object.values(h.dimensions).some((d) => d.method === "ai") ? <Badge variant="accent">Objective + AI</Badge> : <Badge>Objective</Badge>}</td>
                    <td className="py-2 text-right"><Link className="text-xs text-accent hover:underline" href={`/cases/${h.caseId}/review?attempt=${h.attempt}`}>Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
