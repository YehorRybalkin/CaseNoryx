"use client";

import * as React from "react";
import { BarChartView, ChartCard, LineChartView } from "@/components/charts/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHANNEL_PARAMS, CHANNELS, ECOM_MONTHS, ecomData, type Channel } from "@/lib/cases/ecommerce/data";
import { channelSummary, incrementalContribution } from "@/lib/cases/ecommerce/metrics";
import { fmtEur, fmtEurM, fmtPct, fmtSignedPct } from "@/lib/format";
import { pctChange, roas } from "@/lib/analytics";
import { DataTable, FilterBar, FilterSelect, Kpi, signedTone } from "./shared";

const x2 = (v: number | null) => (v === null ? "n/a" : `${v.toFixed(2)}x`);

export function EcommerceAnalytics() {
  const [year, setYear] = React.useState("2024");
  const [channel, setChannel] = React.useState<Channel>("Paid social");
  const y = Number(year);
  const total = channelSummary({ year: y });
  const prev = channelSummary({ year: y - 1 });
  const rows = CHANNELS.map((c) => {
    const s = channelSummary({ year: y, channel: c });
    const inc = CHANNEL_PARAMS[c].incrementality;
    return { c, s, inc, incRoas: s.roas === null ? null : s.roas * inc, incContribution: c === "Organic & direct" ? s.contribution : incrementalContribution(s, inc) };
  });
  const trend = ECOM_MONTHS.map((m) => {
    const r = ecomData.channels.find((x) => x.month === m && x.channel === channel)!;
    return { month: m, spend: r.spend, roas: roas(r.revenue, r.spend), revenue: r.revenue };
  });
  const paid = rows.filter((r) => r.s.spend > 0);

  return (
    <div>
      <FilterBar>
        <FilterSelect id="e-year" label="Year" value={year} onChange={setYear} options={["2024", "2023"]} />
        <FilterSelect id="e-ch" label="Channel trend" value={channel} onChange={(v) => setChannel(v as Channel)} options={CHANNELS.filter((c) => CHANNEL_PARAMS[c].spend2023 > 0)} className="min-w-56" />
      </FilterBar>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`Marketing spend ${year}`} value={fmtEurM(total.spend, 2)} sub={y === 2024 ? `${fmtSignedPct(pctChange(total.spend, prev.spend))} vs 2023` : undefined} />
        <Kpi label={`Revenue ${year}`} value={fmtEurM(total.revenue, 2)} sub={y === 2024 ? `${fmtSignedPct(pctChange(total.revenue, prev.revenue))} vs 2023` : undefined} />
        <Kpi label="Blended ROAS (all revenue / spend)" value={x2(total.roas)} sub="Includes organic revenue" />
        <Kpi label="Contribution after marketing" value={fmtEurM(total.contribution, 2)} tone={y === 2024 ? signedTone((total.contribution ?? 0) - (prev.contribution ?? 0)) : undefined} sub={y === 2024 ? `${fmtEurM((total.contribution ?? 0) - (prev.contribution ?? 0), 2)} vs 2023` : undefined} />
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Channel economics {year}</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            caption="Channel economics"
            columns={[{ key: "c", label: "Channel" }, { key: "spend", label: "Spend", align: "right" }, { key: "rev", label: "Revenue", align: "right" }, { key: "roas", label: "ROAS", align: "right" }, { key: "be", label: "Break-even ROAS", align: "right" }, { key: "gm", label: "Gross margin", align: "right" }, { key: "cvr", label: "CVR", align: "right" }, { key: "aov", label: "AOV", align: "right" }, { key: "cac", label: "CAC", align: "right" }, { key: "contrib", label: "Contribution", align: "right" }, { key: "inc", label: "Incr. share", align: "right" }, { key: "iroas", label: "Incr. ROAS", align: "right" }, { key: "ic", label: "Incr. contribution", align: "right" }]}
            rows={rows.map(({ c, s, inc, incRoas, incContribution }) => ({
              c, spend: fmtEurM(s.spend, 2), rev: fmtEurM(s.revenue, 2),
              roas: <span className={s.roas !== null && s.breakEvenRoas !== null && s.roas < s.breakEvenRoas ? "text-danger" : ""}>{x2(s.roas)}</span>,
              be: x2(s.breakEvenRoas), gm: fmtPct(s.grossMargin), cvr: fmtPct(s.cvr, 2), aov: fmtEur(s.aov, 2), cac: s.spend > 0 ? fmtEur(s.cac) : "—",
              contrib: <span className={(s.contribution ?? 0) < 0 ? "text-danger" : ""}>{fmtEurM(s.contribution, 2)}</span>,
              inc: c === "Organic & direct" ? "—" : fmtPct(inc, 0), iroas: x2(incRoas),
              ic: <span className={(incContribution ?? 0) < 0 ? "text-danger" : ""}>{fmtEurM(incContribution, 2)}</span>,
            }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">ROAS below break-even ROAS (red) means the channel loses money on every order after product cost, payment fees and fulfilment. Incremental figures apply the holdout-test shares.</p>
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="ROAS vs. break-even ROAS" description={`Paid channels, ${year}`} table={{ columns: [{ key: "c", label: "Channel" }, { key: "roas", label: "ROAS", format: "ratio" }, { key: "be", label: "Break-even", format: "ratio" }], rows: paid.map((r) => ({ c: r.c, roas: r.s.roas, be: r.s.breakEvenRoas })) }}>
          <BarChartView data={paid.map((r) => ({ c: r.c.replace("Paid search – ", "Search "), roas: r.s.roas, be: r.s.breakEvenRoas }))} xKey="c" format="ratio" series={[{ key: "roas", label: "ROAS" }, { key: "be", label: "Break-even ROAS" }]} />
        </ChartCard>
        <ChartCard title="Contribution after marketing by channel" description={year} table={{ columns: [{ key: "c", label: "Channel" }, { key: "v", label: "Contribution", format: "currency" }], rows: rows.map((r) => ({ c: r.c, v: r.s.contribution })) }}>
          <BarChartView data={rows.map((r) => ({ c: r.c.replace("Paid search – ", "Search "), v: r.s.contribution }))} xKey="c" format="currency" series={[{ key: "v", label: "Contribution" }]} colorByValue horizontal height={280} />
        </ChartCard>
        <ChartCard title={`${channel}: monthly spend`} table={{ columns: [{ key: "month", label: "Month" }, { key: "spend", label: "Spend", format: "currency" }, { key: "revenue", label: "Revenue", format: "currency" }], rows: trend }}>
          <LineChartView data={trend} xKey="month" format="currency" series={[{ key: "spend", label: "Spend" }]} />
        </ChartCard>
        <ChartCard title={`${channel}: monthly ROAS`} table={{ columns: [{ key: "month", label: "Month" }, { key: "roas", label: "ROAS", format: "ratio" }], rows: trend }}>
          <LineChartView data={trend} xKey="month" format="ratio" series={[{ key: "roas", label: "ROAS" }]} />
        </ChartCard>
      </div>
      <ChartCard className="mt-4" title="Repeat purchase by acquisition channel" description="Customers acquired in 2024" table={{ columns: [{ key: "acquisition_channel", label: "Channel" }, { key: "repeat_rate_180d", label: "Repeat 180d", format: "percent" }, { key: "orders_per_customer_12m", label: "Orders / customer", format: "number" }], rows: ecomData.repeat }}>
        <BarChartView data={ecomData.repeat.map((r) => ({ c: r.acquisition_channel.replace("Paid search – ", "Search "), v: r.repeat_rate_180d }))} xKey="c" format="percent" series={[{ key: "v", label: "Repeat within 180 days" }]} height={220} />
      </ChartCard>
    </div>
  );
}
