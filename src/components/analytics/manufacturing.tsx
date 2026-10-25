"use client";

import * as React from "react";
import { BarChartView, ChartCard, LineChartView } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { costPerGoodUnit, defectRate, safeDivide } from "@/lib/analytics";
import { MFG_MONTHS, STAGES, mfgData } from "@/lib/cases/manufacturing/data";
import { costBreakdown, plantSummary, stageSummary } from "@/lib/cases/manufacturing/metrics";
import { fmtEur, fmtEurM, fmtNumber, fmtPct } from "@/lib/format";
import { DataTable, FilterBar, FilterSelect, Kpi } from "./shared";

const PERIODS: Record<string, { from: string; to: string; label: string }> = {
  all: { from: "2023-01", to: "2024-12", label: "Jan 2023 – Dec 2024" },
  y23: { from: "2023-01", to: "2023-12", label: "2023" },
  h1: { from: "2024-01", to: "2024-06", label: "H1 2024" },
  h2: { from: "2024-07", to: "2024-12", label: "H2 2024" },
};

export function ManufacturingAnalytics() {
  const [period, setPeriod] = React.useState("all");
  const [compare, setCompare] = React.useState("y23");
  const f = PERIODS[period];
  const c = PERIODS[compare];
  const plant = plantSummary(f);
  const base = plantSummary(c);
  const stages = STAGES.map((s) => ({ s, cur: stageSummary(s, f), cmp: stageSummary(s, c) }));
  const months = MFG_MONTHS.filter((m) => m >= f.from && m <= f.to);
  const byStage = (fn: (r: (typeof mfgData.production)[number]) => number | null) =>
    months.map((m) => ({ month: m, ...Object.fromEntries(STAGES.map((s) => [s, fn(mfgData.production.find((r) => r.month === m && r.stage === s)!)])) }));
  const downtime = byStage((r) => safeDivide(r.unplanned_downtime_hours, r.available_hours));
  const defects = byStage((r) => defectRate(r.defective_units, r.units_processed));
  const delivery = months.map((m) => {
    const s = mfgData.summary.find((x) => x.month === m)!;
    return { month: m, otd: safeDivide(s.on_time, s.shipped), backlog: s.backlog, cpgu: costPerGoodUnit(s.total_cost, s.good_output), demand: s.demand, good: s.good_output };
  });
  const costs = costBreakdown(f).map((x) => ({ ...x, perUnit: safeDivide(x.amount, plant.good), cmpPerUnit: safeDivide(costBreakdown(c).find((y) => y.component === x.component)?.amount ?? null, base.good) }));

  return (
    <div>
      <FilterBar>
        <FilterSelect id="m-period" label="Period" value={period} onChange={setPeriod} options={Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label }))} />
        <FilterSelect id="m-cmp" label="Compare with" value={compare} onChange={setCompare} options={Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label }))} />
      </FilterBar>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="On-time delivery" value={fmtPct(plant.otd)} sub={`${c.label}: ${fmtPct(base.otd)}`} tone={plant.otd !== null && base.otd !== null ? (plant.otd < base.otd - 0.001 ? "bad" : plant.otd > base.otd + 0.001 ? "good" : undefined) : undefined} />
        <Kpi label="Cost per good unit" value={fmtEur(plant.costPerGoodUnit, 2)} sub={`${c.label}: ${fmtEur(base.costPerGoodUnit, 2)}`} tone={plant.costPerGoodUnit !== null && base.costPerGoodUnit !== null ? (plant.costPerGoodUnit > base.costPerGoodUnit + 0.005 ? "bad" : plant.costPerGoodUnit < base.costPerGoodUnit - 0.005 ? "good" : undefined) : undefined} />
        <Kpi label="Good output" value={fmtNumber(plant.good)} sub={`Demand ${fmtNumber(plant.demand)}`} />
        <Kpi label="Backlog at period end" value={fmtNumber(plant.endBacklog)} sub="units" />
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Stage performance: {f.label} (vs {c.label})</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            caption="Stage performance"
            columns={[{ key: "s", label: "Stage" }, { key: "util", label: "Utilisation", align: "right" }, { key: "un", label: "Unplanned downtime", align: "right" }, { key: "def", label: "Defect rate", align: "right" }, { key: "eff", label: "Effective capacity (good units)", align: "right" }, { key: "good", label: "Good output", align: "right" }]}
            rows={stages.map(({ s, cur, cmp }) => ({
              s, util: `${fmtPct(cur.utilization)} (${fmtPct(cmp.utilization)})`, un: `${fmtPct(cur.unplannedShare)} (${fmtPct(cmp.unplannedShare)})`,
              def: `${fmtPct(cur.defectRate)} (${fmtPct(cmp.defectRate)})`, eff: fmtNumber(cur.effectiveCapacity), good: fmtNumber(cur.good),
            }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">Effective capacity = run hours × rated speed × (1 − defect rate). The stage with the lowest effective capacity relative to demand constrains the plant.</p>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Unplanned downtime share by stage" table={{ columns: [{ key: "month", label: "Month" }, ...STAGES.map((s) => ({ key: s, label: s, format: "percent" as const }))], rows: downtime }}>
          <LineChartView data={downtime} xKey="month" format="percent" series={STAGES.map((s) => ({ key: s, label: s }))} />
        </ChartCard>
        <ChartCard title="Defect rate by stage" table={{ columns: [{ key: "month", label: "Month" }, ...STAGES.map((s) => ({ key: s, label: s, format: "percent" as const }))], rows: defects }}>
          <LineChartView data={defects} xKey="month" format="percent" series={STAGES.map((s) => ({ key: s, label: s }))} />
        </ChartCard>
        <ChartCard title="On-time delivery" table={{ columns: [{ key: "month", label: "Month" }, { key: "otd", label: "OTD", format: "percent" }, { key: "backlog", label: "Backlog", format: "integer" }], rows: delivery }}>
          <LineChartView data={delivery} xKey="month" format="percent" series={[{ key: "otd", label: "On-time delivery" }]} />
        </ChartCard>
        <ChartCard title="Order backlog (units)" table={{ columns: [{ key: "month", label: "Month" }, { key: "backlog", label: "Backlog", format: "integer" }, { key: "demand", label: "Demand", format: "integer" }, { key: "good", label: "Good output", format: "integer" }], rows: delivery }}>
          <BarChartView data={delivery} xKey="month" format="integer" series={[{ key: "backlog", label: "Backlog" }]} />
        </ChartCard>
        <ChartCard title="Cost per good unit" table={{ columns: [{ key: "month", label: "Month" }, { key: "cpgu", label: "Cost / good unit", format: "number" }], rows: delivery }}>
          <LineChartView data={delivery} xKey="month" format="currency" series={[{ key: "cpgu", label: "Cost per good unit" }]} />
        </ChartCard>
        <ChartCard title="Cost per good unit by component" description={`${f.label} vs ${c.label}`} table={{ columns: [{ key: "component", label: "Component" }, { key: "amount", label: "Total", format: "currencyM" }, { key: "perUnit", label: "€/good unit", format: "number" }, { key: "cmpPerUnit", label: `€/unit ${c.label}`, format: "number" }], rows: costs }}>
          <BarChartView data={costs} xKey="component" format="currency" series={[{ key: "cmpPerUnit", label: c.label }, { key: "perUnit", label: f.label }]} horizontal height={280} />
        </ChartCard>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Total plant cost in period: {fmtEurM(plant.totalCost, 2)}.</p>
    </div>
  );
}
