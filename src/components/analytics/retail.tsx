"use client";

import * as React from "react";
import { BarChartView, ChartCard, LineChartView } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/ui/misc";
import { pctChange, ppChange, sumMoney } from "@/lib/analytics";
import { RETAIL_CATEGORIES, RETAIL_MONTHS, RETAIL_REGIONS, retailData } from "@/lib/cases/retail/data";
import { pnl, segmentSummary } from "@/lib/cases/retail/metrics";
import { fmtEurM, fmtPct, fmtPp, fmtSignedPct } from "@/lib/format";
import { DataTable, FilterBar, FilterSelect, Kpi, signedTone } from "./shared";

export function RetailAnalytics() {
  const [region, setRegion] = React.useState("All");
  const [category, setCategory] = React.useState("All");
  const [from, setFrom] = React.useState(RETAIL_MONTHS[0]);
  const [to, setTo] = React.useState(RETAIL_MONTHS[RETAIL_MONTHS.length - 1]);

  const sales = React.useMemo(() => retailData.sales.filter((s) => (region === "All" || s.region === region) && (category === "All" || s.category === category)), [region, category]);
  const groupLevel = region === "All" && category === "All";
  const y = (yr: number) => sales.filter((s) => s.year === yr);
  const opex = (yr: number) => (groupLevel ? retailData.opex.filter((o) => o.year === yr) : []);
  const p23 = pnl(y(2023), opex(2023));
  const p24 = pnl(y(2024), opex(2024));

  const monthly = RETAIL_MONTHS.filter((m) => m >= from && m <= to).map((m) => {
    const rows = sales.filter((s) => s.month === m);
    const net = sumMoney(rows.map((r) => r.net_sales));
    const gp = sumMoney(rows.map((r) => r.gross_profit));
    return { month: m, netSales: net, grossProfit: gp, grossMargin: net ? gp / net : null };
  });

  const cat23 = new Map(segmentSummary(y(2023), "category").map((c) => [c.key, c]));
  const cats = segmentSummary(y(2024), "category").map((c) => {
    const b = cat23.get(c.key)!;
    return { ...c, base: b, gpChange: c.grossProfit - b.grossProfit, growth: pctChange(c.netSales, b.netSales), gmPp: ppChange(c.grossMargin, b.grossMargin), priceChange: pctChange(c.avgPrice, b.avgPrice) };
  });
  const reg23 = new Map(segmentSummary(y(2023), "region").map((c) => [c.key, c]));
  const regs = segmentSummary(y(2024), "region").map((c) => ({ ...c, base: reg23.get(c.key)! }));

  const opexLines = [...new Set(retailData.opex.map((o) => o.expense_line))].map((l) => {
    const a = sumMoney(retailData.opex.filter((o) => o.year === 2023 && o.expense_line === l).map((o) => o.amount));
    const b = sumMoney(retailData.opex.filter((o) => o.year === 2024 && o.expense_line === l).map((o) => o.amount));
    return { line: l, FY2023: a, FY2024: b, growth: pctChange(b, a) };
  });

  return (
    <div>
      <FilterBar>
        <FilterSelect id="r-region" label="Region" value={region} onChange={setRegion} options={["All", ...RETAIL_REGIONS]} />
        <FilterSelect id="r-cat" label="Category" value={category} onChange={setCategory} options={["All", ...RETAIL_CATEGORIES]} />
        <FilterSelect id="r-from" label="Trend from" value={from} onChange={setFrom} options={RETAIL_MONTHS.filter((m) => m <= to)} />
        <FilterSelect id="r-to" label="Trend to" value={to} onChange={setTo} options={RETAIL_MONTHS.filter((m) => m >= from)} />
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Net sales FY2024" value={fmtEurM(p24.netSales)} sub={`${fmtSignedPct(pctChange(p24.netSales, p23.netSales))} vs FY2023`} tone={signedTone(pctChange(p24.netSales, p23.netSales))} />
        <Kpi label="Gross profit FY2024" value={fmtEurM(p24.grossProfit)} sub={`${fmtSignedPct(pctChange(p24.grossProfit, p23.grossProfit))} vs FY2023`} tone={signedTone(pctChange(p24.grossProfit, p23.grossProfit))} />
        <Kpi label="Gross margin FY2024" value={fmtPct(p24.grossMargin)} sub={`${fmtPp(ppChange(p24.grossMargin, p23.grossMargin))} vs FY2023`} tone={signedTone(ppChange(p24.grossMargin, p23.grossMargin))} />
        {groupLevel ? (
          <Kpi label="Operating profit FY2024" value={fmtEurM(p24.operatingProfit)} sub={`${fmtEurM(p24.operatingProfit - p23.operatingProfit)} vs FY2023 · margin ${fmtPct(p24.operatingMargin)}`} tone={signedTone(p24.operatingProfit - p23.operatingProfit)} />
        ) : (
          <Kpi label="Return rate FY2024" value={fmtPct(p24.returnRate)} sub={`${fmtPp(ppChange(p24.returnRate, p23.returnRate))} vs FY2023`} tone={signedTone(ppChange(p24.returnRate, p23.returnRate), false)} />
        )}
      </div>
      {!groupLevel && <Callout className="mt-3">Operating expenses are only available at group level, so operating profit is shown when no region or category filter is applied.</Callout>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly net sales and gross profit" description="Filtered selection" table={{ columns: [{ key: "month", label: "Month" }, { key: "netSales", label: "Net sales", format: "currencyM" }, { key: "grossProfit", label: "Gross profit", format: "currencyM" }], rows: monthly }}>
          <LineChartView data={monthly} xKey="month" format="currency" series={[{ key: "netSales", label: "Net sales" }, { key: "grossProfit", label: "Gross profit" }]} />
        </ChartCard>
        <ChartCard title="Monthly gross margin" description="Gross profit / net sales" table={{ columns: [{ key: "month", label: "Month" }, { key: "grossMargin", label: "Gross margin", format: "percent" }], rows: monthly }}>
          <LineChartView data={monthly} xKey="month" format="percent" series={[{ key: "grossMargin", label: "Gross margin" }]} />
        </ChartCard>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Category economics: FY2023 → FY2024</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            caption="Category economics"
            columns={[
              { key: "cat", label: "Category" }, { key: "sales", label: "Net sales FY24", align: "right" }, { key: "growth", label: "Growth", align: "right" },
              { key: "share", label: "Share FY23 → FY24", align: "right" }, { key: "price", label: "Avg. price Δ", align: "right" }, { key: "gm", label: "GM FY23 → FY24", align: "right" },
              { key: "gmpp", label: "GM Δ", align: "right" }, { key: "gp", label: "GP Δ", align: "right" }, { key: "ret", label: "Return rate FY23 → FY24", align: "right" },
            ]}
            rows={cats.map((c) => ({
              cat: c.key, sales: fmtEurM(c.netSales), growth: fmtSignedPct(c.growth), share: `${fmtPct(c.base.share)} → ${fmtPct(c.share)}`,
              price: fmtSignedPct(c.priceChange), gm: `${fmtPct(c.base.grossMargin)} → ${fmtPct(c.grossMargin)}`, gmpp: fmtPp(c.gmPp), gp: fmtEurM(c.gpChange),
              ret: `${fmtPct(c.base.returnRate)} → ${fmtPct(c.returnRate)}`,
            }))}
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Change in gross profit by category" description="FY2024 − FY2023" table={{ columns: [{ key: "category", label: "Category" }, { key: "change", label: "GP change", format: "currencyM" }], rows: cats.map((c) => ({ category: c.key, change: c.gpChange })) }}>
          <BarChartView data={cats.map((c) => ({ category: c.key, change: c.gpChange }))} xKey="category" format="currency" series={[{ key: "change", label: "Gross profit change" }]} colorByValue />
        </ChartCard>
        <ChartCard title="Operating expenses by line" description="Group level, FY2023 vs FY2024" table={{ columns: [{ key: "line", label: "Line" }, { key: "FY2023", label: "FY2023", format: "currencyM" }, { key: "FY2024", label: "FY2024", format: "currencyM" }, { key: "growth", label: "Growth", format: "percent" }], rows: opexLines }}>
          <BarChartView data={opexLines} xKey="line" format="currency" series={[{ key: "FY2023", label: "FY2023" }, { key: "FY2024", label: "FY2024" }]} horizontal height={280} />
        </ChartCard>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Regional performance</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            caption="Regional performance"
            columns={[{ key: "r", label: "Region" }, { key: "s", label: "Net sales FY24", align: "right" }, { key: "g", label: "Growth", align: "right" }, { key: "gm", label: "GM FY23 → FY24", align: "right" }]}
            rows={regs.map((r) => ({ r: r.key, s: fmtEurM(r.netSales), g: fmtSignedPct(pctChange(r.netSales, r.base.netSales)), gm: `${fmtPct(r.base.grossMargin)} → ${fmtPct(r.grossMargin)}` }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
