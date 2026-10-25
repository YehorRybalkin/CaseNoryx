"use client";

import * as React from "react";
import { BarChartView, ChartCard, LineChartView } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { airlineData } from "@/lib/cases/airline/data";
import { BASE_ASSUMPTIONS, routePnl, type RouteAssumptions } from "@/lib/cases/airline/model";
import { fmtEur, fmtEurM, fmtNumber, fmtPct } from "@/lib/format";
import { DataTable, FilterBar, FilterSelect, Kpi, signedTone } from "./shared";

const DEMAND: Record<string, number> = { base: 0, low: -0.15, high: 0.12 };

export function AirlineAnalytics() {
  const [demand, setDemand] = React.useState("base");
  const [fuel, setFuel] = React.useState("850");
  const [schedule, setSchedule] = React.useState("plan");
  const [oneOffs, setOneOffs] = React.useState("yes");
  const a: RouteAssumptions = { ...BASE_ASSUMPTIONS, demandChange: DEMAND[demand], fuelPrice: Number(fuel), winterFrequency: schedule === "seasonal" ? 0 : null, includeOneOffs: oneOffs === "yes" };
  const p = routePnl(a);
  const months = p.months.map((m) => ({ ...m, label: m.month }));
  const sens = [
    { label: "Demand −15%", r: routePnl({ ...a, demandChange: a.demandChange - 0.15 }).operatingResult },
    { label: "Demand +12%", r: routePnl({ ...a, demandChange: a.demandChange + 0.12 }).operatingResult },
    { label: "Fares −10%", r: routePnl({ ...a, fareChange: -0.1 }).operatingResult },
    { label: "Fares +10%", r: routePnl({ ...a, fareChange: 0.1 }).operatingResult },
    { label: "Fuel €1,020/t", r: routePnl({ ...a, fuelPrice: 1020 }).operatingResult },
    { label: "Fuel €700/t", r: routePnl({ ...a, fuelPrice: 700 }).operatingResult },
  ].map((s) => ({ ...s, delta: s.r - p.operatingResult }));

  return (
    <div>
      <FilterBar>
        <FilterSelect id="a-dem" label="Demand case" value={demand} onChange={setDemand} options={[{ value: "base", label: "Base" }, { value: "low", label: "Low (−15%)" }, { value: "high", label: "High (+12%)" }]} />
        <FilterSelect id="a-fuel" label="Fuel price" value={fuel} onChange={setFuel} options={airlineData.fuelScenarios.map((f) => ({ value: String(f.jet_fuel_eur_per_tonne), label: `${f.scenario} (€${f.jet_fuel_eur_per_tonne}/t)` }))} />
        <FilterSelect id="a-sched" label="Schedule" value={schedule} onChange={setSchedule} options={[{ value: "plan", label: "Year-round plan" }, { value: "seasonal", label: "Seasonal (Apr–Oct)" }]} />
        <FilterSelect id="a-oneoff" label="One-off launch costs" value={oneOffs} onChange={setOneOffs} options={[{ value: "yes", label: "Included (year 1)" }, { value: "no", label: "Excluded (run-rate)" }]} />
      </FilterBar>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Revenue" value={fmtEurM(p.revenue, 2)} sub={`${fmtNumber(p.passengers)} passengers`} />
        <Kpi label="Contribution" value={fmtEurM(p.contribution, 2)} tone={signedTone(p.contribution)} sub={fmtPct(p.revenue ? p.contribution / p.revenue : null) + " of revenue"} />
        <Kpi label="Operating result" value={fmtEurM(p.operatingResult, 2)} tone={signedTone(p.operatingResult)} sub={`Fixed costs ${fmtEurM(p.fixedCosts, 2)}`} />
        <Kpi label="Load factor" value={fmtPct(p.loadFactor)} sub={`${fmtNumber(p.seats)} seats`} />
        <Kpi label="Break-even load factor" value={fmtPct(p.breakEvenLf)} tone={p.breakEvenLf !== null && p.loadFactor !== null ? (p.breakEvenLf > p.loadFactor ? "bad" : "good") : undefined} sub={p.breakEvenLf !== null && p.loadFactor !== null ? (p.breakEvenLf > p.loadFactor ? "Above forecast LF" : "Below forecast LF") : ""} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly contribution" description="Revenue − variable costs" table={{ columns: [{ key: "label", label: "Month" }, { key: "contribution", label: "Contribution", format: "currency" }], rows: months }}>
          <BarChartView data={months} xKey="label" format="currency" series={[{ key: "contribution", label: "Contribution" }]} colorByValue />
        </ChartCard>
        <ChartCard title="Monthly load factor" description="Dashed line: full-year break-even load factor" table={{ columns: [{ key: "label", label: "Month" }, { key: "loadFactor", label: "Load factor", format: "percent" }], rows: months }}>
          <LineChartView data={months.filter((m) => m.operating)} xKey="label" format="percent" series={[{ key: "loadFactor", label: "Load factor" }]} referenceY={p.breakEvenLf !== null ? { value: p.breakEvenLf, label: `Break-even ${fmtPct(p.breakEvenLf)}` } : undefined} />
        </ChartCard>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Monthly route P&L</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            caption="Monthly route P&L"
            columns={[{ key: "m", label: "Month" }, { key: "s", label: "Sectors", align: "right" }, { key: "seats", label: "Seats", align: "right" }, { key: "d", label: "Demand", align: "right" }, { key: "pax", label: "Passengers", align: "right" }, { key: "lf", label: "LF", align: "right" }, { key: "rev", label: "Revenue", align: "right" }, { key: "vc", label: "Variable costs", align: "right" }, { key: "c", label: "Contribution", align: "right" }, { key: "fc", label: "Fixed", align: "right" }, { key: "op", label: "Result", align: "right" }]}
            rows={[
              ...p.months.map((m) => ({ m: m.month, s: fmtNumber(m.sectors), seats: fmtNumber(m.seats), d: fmtNumber(m.demand), pax: fmtNumber(m.passengers), lf: fmtPct(m.loadFactor), rev: fmtEur(m.revenue), vc: fmtEur(m.variableCosts), c: <span className={m.contribution < 0 ? "text-danger" : ""}>{fmtEur(m.contribution)}</span>, fc: fmtEur(m.fixedCosts), op: <span className={m.operatingResult < 0 ? "text-danger" : ""}>{fmtEur(m.operatingResult)}</span> })),
              { m: <strong>Total{p.oneOffs ? " (+ one-offs)" : ""}</strong>, s: fmtNumber(p.sectors), seats: fmtNumber(p.seats), d: "", pax: fmtNumber(p.passengers), lf: fmtPct(p.loadFactor), rev: fmtEur(p.revenue), vc: fmtEur(p.variableCosts), c: <strong>{fmtEur(p.contribution)}</strong>, fc: fmtEur(p.fixedCosts), op: <strong className={p.operatingResult < 0 ? "text-danger" : "text-success"}>{fmtEur(p.operatingResult)}</strong> },
            ]}
          />
        </CardContent>
      </Card>
      <ChartCard className="mt-4" title="Sensitivity of operating result" description="One driver changed at a time from the current selection" table={{ columns: [{ key: "label", label: "Change" }, { key: "r", label: "Result", format: "currency" }, { key: "delta", label: "Impact", format: "currency" }], rows: sens }}>
        <BarChartView data={sens} xKey="label" format="currency" series={[{ key: "delta", label: "Impact on operating result" }]} colorByValue horizontal height={240} />
      </ChartCard>
    </div>
  );
}
