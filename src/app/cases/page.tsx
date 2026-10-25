import type { Metadata } from "next";
import { CaseLibrary, type LibraryItem } from "@/components/cases/case-library";
import { PageHeader } from "@/components/ui/misc";
import { caseSummaries } from "@/lib/cases/registry";
import { getPerformance } from "@/server/services";

export const metadata: Metadata = { title: "Case Library" };

export default async function CasesPage() {
  const perf = await getPerformance();
  const items: LibraryItem[] = caseSummaries().map((c) => {
    const p = perf.progress.find((x) => x.caseId === c.slug);
    const scores = perf.history.filter((h) => h.caseId === c.slug).map((h) => h.objectiveScore);
    return {
      ...c,
      status: (p?.status as LibraryItem["status"]) ?? "not_started",
      attempts: p?.attempts ?? 0,
      bestScore: scores.length ? Math.max(...scores) : null,
    };
  });
  return (
    <div>
      <PageHeader eyebrow="Case Library" title="Consulting cases" description="Five fully playable engagements with synthetic but internally consistent datasets. Each case has a hidden answer key that is only revealed after you submit." />
      <CaseLibrary items={items} />
    </div>
  );
}
