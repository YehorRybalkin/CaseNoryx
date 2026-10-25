import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvaluationReportView } from "@/components/review/evaluation-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getCase } from "@/lib/cases/registry";
import { fmtDateTime } from "@/lib/format";
import { listSubmissions } from "@/server/services";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ attempt?: string }> };

export const metadata: Metadata = { title: "Evaluation review" };

export default async function ReviewPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { attempt } = await searchParams;
  const def = getCase(slug);
  if (!def) notFound();
  const subs = await listSubmissions(def.slug);
  const selected = subs.find((s) => String(s.attempt) === attempt) ?? subs[0];

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/cases" className="hover:underline">Case Library</Link><ChevronRight className="size-3" />
        <Link href={`/cases/${def.slug}`} className="hover:underline">{def.title}</Link><ChevronRight className="size-3" />
        <span className="text-foreground">Evaluation</span>
      </nav>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evaluation: {def.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{def.client} · {subs.length} submission{subs.length === 1 ? "" : "s"}</p>
        </div>
        <Button asChild variant="outline"><Link href={`/cases/${def.slug}?tab=recommendation`}><ArrowLeft /> Back to workspace</Link></Button>
      </div>
      {!selected ? (
        <EmptyState title="No submission yet" description="The evaluation and model solution become available after you submit a recommendation for this case." action={<Button asChild><Link href={`/cases/${def.slug}?tab=recommendation`}>Go to recommendation</Link></Button>} />
      ) : (
        <>
          {subs.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2" role="navigation" aria-label="Attempts">
              {subs.map((s) => (
                <Link key={s.id} href={`/cases/${def.slug}/review?attempt=${s.attempt}`} className={`rounded-lg border px-3 py-2 text-xs ${s.id === selected.id ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2"}`}>
                  <div className="font-medium">Attempt {s.attempt}</div>
                  <div className="text-muted-foreground">{s.evaluation ? (s.evaluation.overallScore !== null ? `${s.evaluation.overallScore}/100` : `${s.evaluation.objectiveScore}% objective`) : "Not evaluated"}</div>
                </Link>
              ))}
            </div>
          )}
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge>Attempt {selected.attempt}</Badge> Submitted {fmtDateTime(selected.submittedAt)} · locked snapshot
          </div>
          {selected.evaluation ? (
            <EvaluationReportView def={def} report={selected.evaluation.report} content={selected.content} />
          ) : (
            <EmptyState title="Evaluation not available" description="The submission is locked but its evaluation did not complete. Retry it from the Recommendation tab." action={<Button asChild><Link href={`/cases/${def.slug}?tab=recommendation`}>Open recommendation</Link></Button>} />
          )}
        </>
      )}
    </div>
  );
}
