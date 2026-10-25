import { Activity, ArrowRight, Award, BookOpen, CheckCircle2, Target, Timer } from "lucide-react";
import Link from "next/link";
import { DifficultyChart, ScoreProgression, SkillRadar } from "@/components/dashboard/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar, StatTile } from "@/components/ui/misc";
import { CASES, getCase } from "@/lib/cases/registry";
import { fmtDateTime } from "@/lib/format";
import { performanceStats } from "@/lib/performance";
import { getPerformance, getSettings } from "@/server/services";

export default async function DashboardPage() {
  const [perf, settings] = await Promise.all([getPerformance(), getSettings()]);
  const stats = performanceStats(perf.history);
  const progressBy = new Map(perf.progress.map((p) => [p.caseId, p]));
  const completed = CASES.filter((c) => progressBy.get(c.slug)?.completedAt);
  const inProgress = perf.progress.filter((p) => p.status === "in_progress").sort((a, b) => +b.lastActivityAt - +a.lastActivityAt);
  const active = inProgress[0] ? getCase(inProgress[0].caseId) : null;
  const notStarted = CASES.filter((c) => !progressBy.has(c.slug));
  const recommended =
    notStarted[0] ??
    [...CASES].sort((a, b) => (stats.byCase.find((x) => x.caseId === a.slug)?.bestObjective ?? 0) - (stats.byCase.find((x) => x.caseId === b.slug)?.bestObjective ?? 0))[0];
  const isNew = perf.progress.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title={isNew ? `Welcome to CaseNoryx, ${settings.displayName}` : `Welcome back, ${settings.displayName}`}
        description="Think like a consultant. Analyze like an expert. Solve realistic business cases with real data, test your hypotheses and get evidence-based feedback."
        actions={<Button asChild><Link href="/cases"><BookOpen /> Case library</Link></Button>}
      />

      {isNew ? (
        <Card className="mb-6 border-accent/30">
          <CardHeader>
            <CardTitle className="text-base">Get started in four steps</CardTitle>
            <CardDescription>No history yet — everything you see here will be built from your own work.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 text-sm md:grid-cols-4">
              {[
                ["Pick a case", "Start with the beginner Retail case."],
                ["Investigate", "Explore datasets, charts and record hypotheses."],
                ["Simulate", "Test the impact of decisions in the scenario simulator."],
                ["Recommend", "Submit a structured recommendation and get graded."],
              ].map(([t, d], i) => (
                <li key={t} className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold text-accent">Step {i + 1}</div>
                  <div className="font-medium">{t}</div>
                  <div className="text-xs text-muted-foreground">{d}</div>
                </li>
              ))}
            </ol>
            <Button asChild className="mt-4"><Link href={`/cases/${CASES[0].slug}`}>Start “{CASES[0].title}” <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Available cases" value={CASES.length} sub={`${notStarted.length} not started`} icon={<BookOpen />} />
        <StatTile label="Completed cases" value={completed.length} sub={`${stats.submissions} evaluated submission${stats.submissions === 1 ? "" : "s"}`} icon={<CheckCircle2 />} />
        <StatTile
          label="Average score"
          value={stats.averageOverall !== null ? `${stats.averageOverall.toFixed(1)}` : stats.averageObjective !== null ? `${stats.averageObjective.toFixed(1)}%` : "—"}
          sub={stats.averageOverall !== null ? `Overall /100 across ${stats.overallCount} full evaluation(s)` : stats.averageObjective !== null ? "Objective score (overall needs AI evaluation)" : "No evaluations yet"}
          icon={<Award />}
        />
        <StatTile label="Analytical accuracy" value={stats.analyticalAccuracy !== null ? `${stats.analyticalAccuracy.toFixed(0)}%` : "—"} sub="KPI answers within tolerance" icon={<Target />} />
        <StatTile label="In progress" value={inProgress.length} sub={active ? active.title : "No active case"} icon={<Timer />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Continue where you left off</CardTitle>
            <CardDescription>Your active engagement</CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{active.title}</span>
                    <Badge variant="accent">{active.difficulty}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{active.client} · last active {fmtDateTime(inProgress[0].lastActivityAt)} · tab: {inProgress[0].lastTab}</p>
                </div>
                <Button asChild><Link href={`/cases/${active.slug}?tab=${inProgress[0].lastTab}`}>Resume case <ArrowRight /></Link></Button>
              </div>
            ) : (
              <EmptyState title="No case in progress" description="Open any case from the library to begin an engagement." action={<Button asChild variant="outline"><Link href="/cases">Browse cases</Link></Button>} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recommended next case</CardTitle>
            <CardDescription>{notStarted.length ? "Next case you have not started" : "Case with your lowest best score"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2"><span className="font-medium">{recommended.title}</span><Badge>{recommended.difficulty}</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">{recommended.summary}</p>
            <Button asChild variant="outline" size="sm" className="mt-3"><Link href={`/cases/${recommended.slug}`}>Open case <ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ScoreProgression timeline={stats.timeline} /></div>
        <SkillRadar skills={stats.skills} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Case completion</CardTitle><CardDescription>{completed.length} of {CASES.length} cases completed</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {CASES.map((c) => {
              const p = progressBy.get(c.slug);
              const best = stats.byCase.find((b) => b.caseId === c.slug);
              const status = !p ? "Not started" : p.status === "in_progress" ? (p.attempts > 0 ? "Re-attempting" : "In progress") : p.status === "submitted" ? "Awaiting evaluation" : "Completed";
              return (
                <div key={c.slug}>
                  <div className="flex items-center justify-between text-xs">
                    <Link href={`/cases/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
                    <span className="text-muted-foreground">{best ? `best ${best.bestObjective.toFixed(0)}%` : status}</span>
                  </div>
                  <ProgressBar className="mt-1" label={`${c.title} best objective score`} value={best?.bestObjective ?? (p ? 5 : 0)} />
                </div>
              );
            })}
          </CardContent>
        </Card>
        <DifficultyChart rows={stats.byDifficulty} />
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-4" /> Recent activity</CardTitle></CardHeader>
          <CardContent>
            {perf.activity.length === 0 ? (
              <EmptyState title="No activity yet" description="Actions such as starting a case, saving scenarios and submitting appear here." />
            ) : (
              <ul className="space-y-2.5">
                {perf.activity.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div>{a.message}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
