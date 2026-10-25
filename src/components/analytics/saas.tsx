"use client";

import * as React from "react";
import { BarChartView, ChartCard, LineChartView } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sumMoney } from "@/lib/analytics";
import { SAAS_MONTHS, SAAS_SEGMENTS, saasData, type SaasSegment } from "@/lib/cases/saas/data";
import { acquisitionCac, arpa, avgMonthlyChurn, compoundedNrr, grossMargin, monthlySeries, retentionCurve, segmentLtv } from "@/lib/cases/saas/metrics";
import { fmtEur, fmtEurM, fmtNumber, fmtPct } from "@/lib/format";
import { DataTable, FilterBar, FilterSelect, Kpi } from "./shared";

export function SaasAnalytics() {
  const [segment, setSegment] = React.useState<"All" | SaasSegment>("All");
  const [from, setFrom] = React.useState(SAAS_MONTHS[0]);
  const [to, setTo] = React.useState(SAAS_MONTHS[SAAS_MONTHS.length - 1]);
  const [cohortSeg, setCohortSeg] = React.useState<SaasSegment>("SMB");
  const [cohortPeriod, setCohortPeriod] = React.useState("2024");

  const f = { segment, from, to };
  const series = monthlySeries(f);
  const churnBySeg = SAAS_MONTHS.filter((m) => m >= from && m <= to).map((m) => ({
    month: m,
    ...Object.fromEntries(SAAS_SEGMENTS.map((s) => [s, avgMonthlyChurn({ segment: s, from: m, to: m })])),
  }));
  const movements = series.map((s) => ({ month: s.month, New: s.newMrr, Expansion: s.expansion, Contraction: -s.contraction, Churned: -s.churnedMrr }));
  const channels = [...new Set(saasData.cohorts.filter((c) => c.segment === cohortSeg && c.acquisition_channel !== "Legacy").map((c) => c.acquisition_channel))];
  const cohortRange = cohortPeriod === "2024" ? { fromCohort: "2024-01", toCohort: "2024-12" } : { fromCohort: "2023-07", toCohort: "2023-12" };
  const curves = Array.from({ length: 13 }, (_, k) => ({
    k: `M${k}`,
    ...Object.fromEntries(channels.map((ch) => [ch, retentionCurve({ segment: cohortSeg, channel: ch, ...cohortRange }, 12)[k].retention])),
  }));
  const econ = SAAS_SEGMENTS.map((s) => {
    const l = segmentLtv(s, from, to);
    return { s, arpa: arpa({ segment: s, from, to }), churn: avgMonthlyChurn({ segment: s, from, to }), nrr: compoundedNrr({ segment: s, from, to }), ...l };
  });
  const cacRows = [...new Set(saasData.acquisition.filter((a) => segment === "All" || a.segment === segment).map((a) => `${a.segment}|${a.channel}`))].map((k) => {
    const [seg, ch] = k.split("|") as [SaasSegment, string];
    const rows = saasData.acquisition.filter((a) => a.segment === seg && a.channel === ch && a.month >= from && a.month <= to);
    return { seg, ch, n: rows.reduce((a, r) => a + r.new_customers, 0), spend: sumMoney(rows.map((r) => r.acquisition_spend)), cac: acquisitionCac({ segment: seg, channel: ch, from, to }) };
  });
  const costLines = [...new Set(saasData.serviceCosts.map((c) => c.cost_line))];
  const costs = SAAS_MONTHS.filter((m) => m >= from && m <= to).map((m) => ({
    month: m,
    ...Object.fromEntries(costLines.map((l) => [l, saasData.serviceCosts.find((c) => c.month === m && c.cost_line === l)?.amount ?? 0])),
    gm: grossMargin({ from: m, to: m }),
  }));
  const last = series[series.length - 1];

  return (
    <div>
      <FilterBar>
        <FilterSelect id="s-seg" label="Segment" value={segment} onChange={(v) => setSegment(v as typeof segment)} options={["All", ...SAAS_SEGMENTS]} />
        <FilterSelect id="s-from" label="From" value={from} onChange={setFrom} options={SAAS_MONTHS.filter((m) => m <= to)} />
        <FilterSelect id="s-to" label="To" value={to} onChange={setTo} options={SAAS_MONTHS.filter((m) => m >= from)} />
      </FilterBar>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Customers (end of period)" value={fmtNumber(last?.customers)} />
        <Kpi label="MRR (end of period)" value={fmtEurM(last?.mrr)} />
        <Kpi label="Avg. monthly logo churn" value={fmtPct(avgMonthlyChurn(f), 2)} sub="Pooled: Σ churned / Σ starting" />
        <Kpi label="NRR (compounded)" value={fmtPct(compoundedNrr(f))} sub={`${series.length} months`} />
        <Kpi label="Gross margin (all segments)" value={fmtPct(grossMargin({ from, to }))} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Active customers" table={{ columns: [{ key: "month", label: "Month" }, { key: "customers", label: "Customers", format: "integer" }, { key: "newCustomers", label: "New", format: "integer" }, { key: "churned", label: "Churned", format: "integer" }], rows: series }}>
          <LineChartView data={series} xKey="month" format="integer" series={[{ key: "customers", label: "Customers" }]} />
        </ChartCard>
        <ChartCard title="Monthly logo churn by segment" table={{ columns: [{ key: "month", label: "Month" }, ...SAAS_SEGMENTS.map((s) => ({ key: s, label: s, format: "percent" as const }))], rows: churnBySeg }}>
          <LineChartView data={churnBySeg} xKey="month" format="percent" series={SAAS_SEGMENTS.map((s) => ({ key: s, label: s }))} />
        </ChartCard>
        <ChartCard title="MRR movements" description="New and expansion vs. contraction and churn" table={{ columns: [{ key: "month", label: "Month" }, { key: "New", label: "New", format: "currency" }, { key: "Expansion", label: "Expansion", format: "currency" }, { key: "Contraction", label: "Contraction", format: "currency" }, { key: "Churned", label: "Churned", format: "currency" }], rows: movements }}>
          <BarChartView data={movements} xKey="month" format="currency" stacked series={[{ key: "New", label: "New" }, { key: "Expansion", label: "Expansion" }, { key: "Contraction", label: "Contraction" }, { key: "Churned", label: "Churned" }]} />
        </ChartCard>
        <ChartCard
          title="Cohort retention by acquisition channel"
          description="Pooled share of customers still active, by month since acquisition"
          actions={
            <div className="flex gap-1">
              <select aria-label="Cohort segment" className="h-7 rounded border border-border bg-surface px-1 text-xs" value={cohortSeg} onChange={(e) => setCohortSeg(e.target.value as SaasSegment)}>{SAAS_SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select>
              <select aria-label="Cohort period" className="h-7 rounded border border-border bg-surface px-1 text-xs" value={cohortPeriod} onChange={(e) => setCohortPeriod(e.target.value)}><option value="2024">2024 cohorts</option><option value="2023">H2 2023 cohorts</option></select>
            </div>
          }
          table={{ columns: [{ key: "k", label: "Month #" }, ...channels.map((c) => ({ key: c, label: c, format: "percent" as const }))], rows: curves }}
        >
          <LineChartView data={curves} xKey="k" format="percent" series={channels.map((c) => ({ key: c, label: c }))} />
        </ChartCard>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Unit economics by segment ({from} – {to})</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            caption="Unit economics"
            columns={[{ key: "s", label: "Segment" }, { key: "arpa", label: "ARPA / month", align: "right" }, { key: "churn", label: "Monthly churn", align: "right" }, { key: "nrr", label: "NRR (period)", align: "right" }, { key: "ltv", label: "LTV", align: "right" }, { key: "cac", label: "CAC", align: "right" }, { key: "ratio", label: "LTV/CAC", align: "right" }]}
            rows={econ.map((e) => ({ s: e.s, arpa: fmtEur(e.arpa, 0), churn: fmtPct(e.churn, 2), nrr: fmtPct(e.nrr), ltv: fmtEur(e.ltv), cac: fmtEur(e.cac), ratio: e.ratio === null ? "n/a" : `${e.ratio.toFixed(2)}x` }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">LTV = ARPA × blended gross margin × min(1 / churn, 60 months). Gross margin is blended across segments for the period.</p>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>CAC by channel</CardTitle></CardHeader>
          <CardContent>
            <DataTable columns={[{ key: "seg", label: "Segment" }, { key: "ch", label: "Channel" }, { key: "n", label: "New customers", align: "right" }, { key: "spend", label: "Spend", align: "right" }, { key: "cac", label: "CAC", align: "right" }]} rows={cacRows.map((r) => ({ seg: r.seg, ch: r.ch, n: fmtNumber(r.n), spend: fmtEurM(r.spend, 2), cac: fmtEur(r.cac) }))} />
          </CardContent>
        </Card>
        <ChartCard title="Service costs by line" description="Cost of revenue, all segments" table={{ columns: [{ key: "month", label: "Month" }, ...costLines.map((l) => ({ key: l, label: l, format: "currency" as const })), { key: "gm", label: "Gross margin", format: "percent" }], rows: costs }}>
          <BarChartView data={costs} xKey="month" format="currency" stacked series={costLines.map((l) => ({ key: l, label: l }))} />
        </ChartCard>
      </div>
    </div>
  );
}
