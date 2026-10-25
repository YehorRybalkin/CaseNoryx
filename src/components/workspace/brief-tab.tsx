import { Building2, CheckCircle2, Flag, HelpCircle, Quote, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseDefinition } from "@/lib/cases/types";

export function BriefTab({ def }: { def: CaseDefinition }) {
  const b = def.brief;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-accent" /> Client introduction</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>{b.clientIntro}</p>
            <h4 className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business context</h4>
            <ul className="list-disc space-y-1.5 pl-5">{b.context.map((c) => <li key={c}>{c}</li>)}</ul>
          </CardContent>
        </Card>
        <Card className="border-accent/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><Flag className="size-4 text-accent" /> Problem statement</CardTitle></CardHeader>
          <CardContent><p className="text-[15px] font-medium leading-relaxed">{b.problem}</p></CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-4 text-accent" /> Engagement objectives</CardTitle></CardHeader>
            <CardContent><ol className="list-decimal space-y-1.5 pl-5 text-sm">{b.objectives.map((o) => <li key={o}>{o}</li>)}</ol></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-4 text-accent" /> Success criteria</CardTitle></CardHeader>
            <CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm">{b.successCriteria.map((o) => <li key={o}>{o}</li>)}</ul></CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><HelpCircle className="size-4 text-accent" /> Questions to investigate</CardTitle></CardHeader>
          <CardContent><ul className="grid gap-2 text-sm md:grid-cols-2">{def.investigationQuestions.map((q) => <li key={q} className="rounded-lg border border-border p-3">{q}</li>)}</ul></CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Stakeholders</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {b.stakeholders.map((s) => (
              <figure key={s.name} className="rounded-lg bg-surface-2/70 p-3">
                <blockquote className="flex gap-2 text-sm italic"><Quote className="size-4 shrink-0 text-muted-foreground" />{s.quote}</blockquote>
                <figcaption className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{s.name}</span>, {s.role}</figcaption>
              </figure>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Key KPIs</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">{def.kpis.map((k) => <div key={k.label}><dt className="font-medium">{k.label}</dt><dd className="text-xs text-muted-foreground">{k.definition}</dd></div>)}</dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Assumptions & data notice</CardTitle></CardHeader>
          <CardContent>
            <Badge variant="warning" className="mb-2">All data is synthetic</Badge>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{def.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Learning outcomes</CardTitle></CardHeader>
          <CardContent><ul className="list-disc space-y-1 pl-4 text-sm">{def.learningOutcomes.map((a) => <li key={a}>{a}</li>)}</ul></CardContent>
        </Card>
      </div>
    </div>
  );
}
