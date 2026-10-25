"use client";
import { usePathname, useRouter } from "next/navigation";
import { Label, Select } from "@/components/ui/input";
import type { CaseSummary } from "@/lib/cases/types";

export function CasePicker({ cases, value }: { cases: CaseSummary[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="w-full max-w-sm">
      <Label htmlFor="case-picker">Case</Label>
      <Select id="case-picker" className="mt-1" value={value} onChange={(e) => router.push(`${pathname}?case=${e.target.value}`)}>
        {cases.map((c) => <option key={c.slug} value={c.slug}>{c.title} — {c.client}</option>)}
      </Select>
    </div>
  );
}
