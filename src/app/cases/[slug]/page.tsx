import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/workspace";
import { getCase } from "@/lib/cases/registry";
import { EMPTY_RECOMMENDATION } from "@/lib/recommendation";
import { getDraft, getSettings, listHypotheses, listNotes, listScenarios, listSubmissions, touchProgress } from "@/server/services";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const def = getCase((await params).slug);
  return { title: def ? def.title : "Case" };
}

export default async function CasePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const def = getCase(slug);
  if (!def) notFound();
  const progress = await touchProgress(def.slug, tab);
  const [hypotheses, notes, scenarios, draft, submissions, settings] = await Promise.all([
    listHypotheses(def.slug), listNotes(def.slug), listScenarios(def.slug), getDraft(def.slug), listSubmissions(def.slug), getSettings(),
  ]);
  const latest = submissions[0] ?? null;
  return (
    <Suspense>
      <Workspace
        slug={def.slug}
        initialTab={tab ?? progress.lastTab}
        status={progress.status as "in_progress" | "submitted" | "completed"}
        attempts={progress.attempts}
        hypotheses={hypotheses.map((h) => ({ ...h, status: h.status as "untested", updatedAt: h.updatedAt.toISOString() }))}
        notes={notes.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt.toISOString() }))}
        scenarios={scenarios.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
        draft={draft?.content ?? latest?.content ?? EMPTY_RECOMMENDATION}
        draftSavedAt={draft?.updatedAt.toISOString() ?? null}
        latestSubmission={latest ? { attempt: latest.attempt, submittedAt: latest.submittedAt.toISOString(), content: latest.content } : null}
        pendingEvaluation={!!latest && !latest.evaluation}
        coachMode={settings.coachMode}
      />
    </Suspense>
  );
}
