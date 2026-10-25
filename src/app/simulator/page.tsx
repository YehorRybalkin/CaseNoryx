import type { Metadata } from "next";
import Link from "next/link";
import { CasePicker } from "@/components/cases/case-picker";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { SimulatorPageClient } from "@/components/workspace/simulator-page-client";
import { CASES, caseSummaries, getCase } from "@/lib/cases/registry";
import { listScenarios } from "@/server/services";

export const metadata: Metadata = { title: "Scenario Simulator" };

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const { case: c } = await searchParams;
  const def = getCase(c ?? "") ?? CASES[0];
  const saved = await listScenarios(def.slug);
  return (
    <div>
      <PageHeader eyebrow="Scenario Simulator" title="Test business decisions" description="Move the levers to recalculate outcomes deterministically against the case baseline. Saved scenarios are shared with the case workspace." actions={<Button asChild variant="outline"><Link href={`/cases/${def.slug}?tab=scenario`}>Open in workspace</Link></Button>} />
      <div className="mb-4"><CasePicker cases={caseSummaries()} value={def.slug} /></div>
      <SimulatorPageClient slug={def.slug} saved={saved.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))} />
    </div>
  );
}
