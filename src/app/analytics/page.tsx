import type { Metadata } from "next";
import { AnalyticsLab } from "@/components/lab/calculators";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Analytics Laboratory" };

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader eyebrow="Analytics Laboratory" title="Business metrics workbench" description="Practise the formulas behind every case. These calculators use the same tested analytics engine that powers the cases and the grader, including zero-denominator and missing-data handling." />
      <AnalyticsLab />
    </div>
  );
}
