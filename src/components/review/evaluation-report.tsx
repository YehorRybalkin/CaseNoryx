import { AlertTriangle, Bot, CheckCircle2, CircleDashed, Lightbulb, MinusCircle, Target, TrendingUp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, ProgressBar } from "@/components/ui/misc";
import type { CaseDefinition } from "@/lib/cases/types";
import type { EvaluationReport } from "@/lib/evaluation/types";
import { DIMENSION_META } from "@/lib/evaluation/types";
import { RECOMMENDATION_SECTIONS, type RecommendationContent } from "@/lib/recommendation";
import { cn } from "@/lib/utils";

const METHOD_BADGE = {
  objective: <Badge variant="success">Objective</Badge>,
  ai: <Badge variant="accent"><Bot className="size-3" /> AI-generated</Badge>,
  heuristic: <Badge variant="warning">Indicative only</Badge>,
};

function List({ items, icon, empty }: { items: string[]; icon: React.ReactNode; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="space-y-2">{items.map((s, i) => <li key={i} className="flex gap-2 text-sm"><span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span><span>{s}</span></li>)}</ul>;
}

export function EvaluationReportView({ def, report, content }: { def: CaseDefinition; report: EvaluationReport; content: RecommendationContent }) {
  const full = report.overallScore !== null;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>{full ? "Overall score" : "Objective score"}</CardTitle><CardDescription>{full ? "All six rubric dimensions assessed" : `${report.objectivePoints} of ${report.objectiveMax} objectively graded rubric points`}</CardDescription></CardHeader>
          <CardContent>
            <div className="tabular text-5xl font-semibold tracking-tight" data-testid="headline-score">{full ? report.overallScore : `${report.objectiveScore}%`}</div>
            <div className="mt-1 text-xs text-muted-foreground">{full ? "out of 100" : "of objective points"}</div>
            {!full && (
              <Callout tone="warning" className="mt-4" title="No overall score">
                {report.ai.status === "failed" ? `AI evaluation failed: ${report.ai.message} ` : report.ai.status === "disabled" ? "AI evaluation is turned off in Settings. " : "AI evaluation is not configured. "}
                Problem structuring, recommendations and communication received only indicative heuristic checks, so an overall /100 score would be misleading.
              </Callout>
            )}
            {report.ai.status === "used" && <Callout className="mt-4" title="AI qualitative assessment">{report.ai.summary} <span className="block pt-1 text-[11px]">Model: {report.ai.model}. AI assessments can be wrong.</span></Callout>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Rubric</CardTitle><CardDescription>Each dimension has explicit criteria; expand for details.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {report.dimensions.map((d) => (
              <details key={d.id} className="group rounded-lg border border-border p-3" data-testid={`dimension-${d.id}`}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                  <span className="min-w-48 flex-1 text-sm font-medium">{d.label}</span>
                  {METHOD_BADGE[d.method]}
                  <span className={cn("tabular w-20 text-right text-sm font-semibold", d.assessed === "indicative" && "text-muted-foreground")}>{d.score} / {d.max}</span>
                  <ProgressBar className="w-full" value={d.score} max={d.max} label={`${d.label} score`} />
                </summary>
                <p className="mt-3 text-xs text-muted-foreground">{DIMENSION_META[d.id].criteria} {d.explanation}</p>
                <ul className="mt-2 space-y-1">
                  {d.criteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      {c.met === true ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : c.met === false ? <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" /> : <MinusCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />}
                      <span className="flex-1">{c.label}{c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}</span>
                      {c.maxPoints !== undefined && <span className="tabular text-muted-foreground">{c.points}/{c.maxPoints}</span>}
                    </li>
                  ))}
                </ul>
                {d.evidence && d.evidence.length > 0 && (
                  <div className="mt-2 rounded bg-surface-2 p-2 text-xs"><div className="font-medium">Evidence cited by the AI assessor</div><ul className="mt-1 list-disc pl-4 text-muted-foreground">{d.evidence.map((e) => <li key={e}>{e}</li>)}</ul></div>
                )}
              </details>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-4 text-accent" /> Key calculations</CardTitle></CardHeader>
          <CardContent>
            <table className="tabular w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground"><th className="py-1 text-left font-medium">KPI</th><th className="py-1 text-right font-medium">Yours</th><th className="py-1 text-right font-medium">Correct</th><th className="py-1 text-right font-medium">Result</th></tr></thead>
              <tbody>
                {report.quantResults.map((q) => (
                  <tr key={q.id} className="border-t border-border/60 align-top">
                    <td className="py-2 pr-2">{q.prompt}<div className="text-[11px] text-muted-foreground">{q.explanation}</div></td>
                    <td className="py-2 text-right">{q.submitted ?? "—"}</td>
                    <td className="py-2 text-right font-medium">{q.expected} <span className="text-xs text-muted-foreground">{q.unit}</span></td>
                    <td className="py-2 text-right">
                      <Badge variant={q.status === "correct" ? "success" : q.status === "close" ? "warning" : "danger"}>{q.status.replace("_", " ")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Root causes</CardTitle><CardDescription>Answer key: what the data actually shows</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {report.rootCauses.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {r.identifiedInText ? <CheckCircle2 className="size-4 text-success" /> : r.identifiedInDrivers ? <MinusCircle className="size-4 text-warning" /> : <XCircle className="size-4 text-danger" />}
                  <span className="text-sm font-medium">{r.title}</span>
                  <Badge variant={r.identifiedInText ? "success" : r.identifiedInDrivers ? "warning" : "danger"}>{r.identifiedInText ? "Explained" : r.identifiedInDrivers ? "Flagged, not explained" : "Missed"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.explanation}</p>
              </div>
            ))}
            <div>
              <div className="mb-1 text-xs font-medium">Driver selection</div>
              <div className="flex flex-wrap gap-1.5">
                {report.drivers.map((d) => (
                  <Badge key={d.id} variant={d.selected ? (d.classification === "distractor" ? "danger" : "success") : d.classification === "root" ? "warning" : "outline"} title={d.classification}>
                    {d.selected ? "✓ " : ""}{d.label} · {d.classification}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Strengths</CardTitle></CardHeader><CardContent><List items={report.strengths} icon={<CheckCircle2 className="text-success" />} empty="—" /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Weaknesses</CardTitle></CardHeader><CardContent><List items={report.weaknesses} icon={<AlertTriangle className="text-warning" />} empty="No major weaknesses detected." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleDashed className="size-4 text-danger" /> Missed insights</CardTitle></CardHeader><CardContent><List items={report.missedInsights} icon={<CircleDashed className="text-danger" />} empty="You covered every root cause." /></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><XCircle className="size-4 text-danger" /> Quantitative errors</CardTitle></CardHeader><CardContent><List items={report.quantitativeErrors} icon={<XCircle className="text-danger" />} empty="No quantitative errors detected." /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-4 text-accent" /> How to improve</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1"><List items={report.improvements} icon={<Lightbulb className="text-accent" />} empty="—" /></div>
          <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Common mistakes in this case</div><ul className="list-disc space-y-1 pl-4 text-sm">{report.commonMistakes.map((m) => <li key={m}>{m}</li>)}</ul></div>
          <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reasonable alternative interpretations</div><ul className="list-disc space-y-1 pl-4 text-sm">{report.alternativeInterpretations.map((m) => <li key={m}>{m}</li>)}</ul></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your recommendation vs. a strong model answer</CardTitle><CardDescription>Model solution is revealed only after submission.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {RECOMMENDATION_SECTIONS.map((s) => (
            <div key={s.key} className="grid gap-3 border-t border-border pt-4 first:border-0 first:pt-0 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">{s.label} — yours</div>
                <p className="whitespace-pre-wrap text-sm">{content[s.key] || "—"}</p>
              </div>
              <div className="rounded-lg bg-accent-soft/60 p-3">
                <div className="mb-1 text-xs font-semibold text-accent">{s.label} — model answer</div>
                <p className="whitespace-pre-wrap text-sm">{report.modelRecommendation[s.key]}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Callout title="Evaluation method and limitations">
        <ul className="list-disc space-y-1 pl-4">{report.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        <span className="mt-1 block">Case: {def.title}. Facts cited correctly: {report.factsCited.map((f) => `${f.label} (“${f.cited}”)`).join("; ") || "none"}.</span>
      </Callout>
    </div>
  );
}
