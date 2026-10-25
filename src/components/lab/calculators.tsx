"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as A from "@/lib/analytics";
import type { ValueFormat } from "@/lib/cases/types";
import { formatValue } from "@/lib/format";

interface Field { name: string; label: string; unit: string; defaultValue: number; min?: number; max?: number }
interface Output { label: string; value: number | null; format: ValueFormat; formula: string }
interface CalcDef { id: string; title: string; description: string; fields: Field[]; compute: (v: Record<string, number>) => Output[] }

const pct = (x: number) => x / 100;

const CALCS: Record<string, CalcDef[]> = {
  Financial: [
    { id: "pnl", title: "Gross & operating profit", description: "From revenue to operating profit.", fields: [
      { name: "revenue", label: "Revenue", unit: "EUR", defaultValue: 1_000_000, min: 0 },
      { name: "cogs", label: "Cost of goods sold", unit: "EUR", defaultValue: 620_000, min: 0 },
      { name: "opex", label: "Operating expenses", unit: "EUR", defaultValue: 290_000, min: 0 }],
      compute: (v) => {
        const gp = A.grossProfit(v.revenue, v.cogs);
        const op = A.operatingProfit(gp, v.opex);
        return [
          { label: "Gross profit", value: gp, format: "currency", formula: "Revenue − COGS" },
          { label: "Gross margin", value: A.grossMargin(v.revenue, v.cogs), format: "percent", formula: "Gross profit / Revenue" },
          { label: "Operating profit", value: op, format: "currency", formula: "Gross profit − Opex" },
          { label: "Operating margin", value: A.operatingMargin(op, v.revenue), format: "percent", formula: "Operating profit / Revenue" },
        ];
      } },
    { id: "be", title: "Break-even", description: "Volume and revenue needed to cover fixed costs.", fields: [
      { name: "fixed", label: "Fixed costs", unit: "EUR", defaultValue: 500_000, min: 0 },
      { name: "price", label: "Price per unit", unit: "EUR", defaultValue: 40, min: 0 },
      { name: "varCost", label: "Variable cost per unit", unit: "EUR", defaultValue: 25, min: 0 }],
      compute: (v) => {
        const cm = A.contributionMargin(v.price, v.varCost);
        return [
          { label: "Contribution per unit", value: A.contribution(v.price, v.varCost), format: "currency", formula: "Price − variable cost" },
          { label: "Contribution margin", value: cm, format: "percent", formula: "(Price − VC) / Price" },
          { label: "Break-even volume", value: A.breakEvenVolume(v.fixed, v.price, v.varCost), format: "integer", formula: "Fixed costs / (Price − VC)" },
          { label: "Break-even revenue", value: A.breakEvenRevenue(v.fixed, cm), format: "currency", formula: "Fixed costs / CM ratio" },
        ];
      } },
    { id: "growth", title: "Growth", description: "Period-on-period and compound growth.", fields: [
      { name: "previous", label: "Previous period", unit: "EUR", defaultValue: 273.8 },
      { name: "current", label: "Current period", unit: "EUR", defaultValue: 297.2 },
      { name: "periods", label: "Periods for CAGR", unit: "years", defaultValue: 1, min: 1, max: 50 }],
      compute: (v) => [
        { label: "Growth", value: A.revenueGrowth(v.current, v.previous), format: "percent", formula: "(Current − Previous) / |Previous|" },
        { label: "CAGR", value: A.cagr(v.previous, v.current, v.periods), format: "percent", formula: "(End / Start)^(1/n) − 1" },
      ] },
  ],
  Customer: [
    { id: "churn", title: "Churn & retention", description: "Logo churn for a period.", fields: [
      { name: "start", label: "Customers at start", unit: "customers", defaultValue: 4_000, min: 0 },
      { name: "churned", label: "Customers lost", unit: "customers", defaultValue: 160, min: 0 }],
      compute: (v) => [
        { label: "Churn rate", value: A.churnRate(v.churned, v.start), format: "percent", formula: "Churned / Starting customers" },
        { label: "Retention rate", value: A.retentionRate(v.churned, v.start), format: "percent", formula: "1 − churn" },
        { label: "Implied annual retention", value: (() => { const r = A.retentionRate(v.churned, v.start); return r === null ? null : r ** 12; })(), format: "percent", formula: "(1 − monthly churn)^12" },
      ] },
    { id: "ltv", title: "LTV, LTV/CAC & payback", description: "Gross-margin LTV with an explicit lifetime cap.", fields: [
      { name: "arpa", label: "ARPA per month", unit: "EUR", defaultValue: 95, min: 0 },
      { name: "gm", label: "Gross margin", unit: "%", defaultValue: 60, min: 0, max: 100 },
      { name: "churn", label: "Monthly churn", unit: "%", defaultValue: 4, min: 0, max: 100 },
      { name: "cap", label: "Lifetime cap", unit: "months", defaultValue: 60, min: 1, max: 240 },
      { name: "cac", label: "CAC", unit: "EUR", defaultValue: 740, min: 0 }],
      compute: (v) => {
        const l = A.ltv({ arpaMonthly: v.arpa, grossMargin: pct(v.gm), monthlyChurn: pct(v.churn), maxLifetimeMonths: v.cap });
        return [
          { label: "Expected lifetime", value: v.churn === 0 ? v.cap : Math.min(1 / pct(v.churn), v.cap), format: "months", formula: "min(1 / churn, cap)" },
          { label: "LTV", value: l, format: "currency", formula: "ARPA × GM × lifetime" },
          { label: "LTV / CAC", value: A.ltvToCac(l, v.cac), format: "ratio", formula: "LTV / CAC" },
          { label: "CAC payback", value: A.cacPaybackMonths(v.cac, v.arpa, pct(v.gm)), format: "months", formula: "CAC / (ARPA × GM)" },
        ];
      } },
    { id: "nrr", title: "Net revenue retention", description: "Revenue retained from the existing base.", fields: [
      { name: "start", label: "Starting MRR", unit: "EUR", defaultValue: 400_000, min: 0 },
      { name: "exp", label: "Expansion MRR", unit: "EUR", defaultValue: 12_000, min: 0 },
      { name: "con", label: "Contraction MRR", unit: "EUR", defaultValue: 3_000, min: 0 },
      { name: "churned", label: "Churned MRR", unit: "EUR", defaultValue: 9_000, min: 0 }],
      compute: (v) => [
        { label: "NRR", value: A.netRevenueRetention({ starting: v.start, expansion: v.exp, contraction: v.con, churned: v.churned }), format: "percent", formula: "(Start + exp − con − churn) / Start" },
        { label: "GRR", value: A.grossRevenueRetention({ starting: v.start, contraction: v.con, churned: v.churned }), format: "percent", formula: "(Start − con − churn) / Start" },
      ] },
  ],
  Marketing: [
    { id: "roas", title: "ROAS vs. profitability", description: "Why ROAS above 1x can still lose money.", fields: [
      { name: "spend", label: "Ad spend", unit: "EUR", defaultValue: 100_000, min: 0 },
      { name: "revenue", label: "Attributed revenue", unit: "EUR", defaultValue: 235_000, min: 0 },
      { name: "orders", label: "Orders", unit: "orders", defaultValue: 3_000, min: 0 },
      { name: "gm", label: "Product gross margin", unit: "%", defaultValue: 35, min: 0, max: 100 },
      { name: "fee", label: "Payment fee rate", unit: "%", defaultValue: 1.8, min: 0, max: 100 },
      { name: "fulfil", label: "Fulfilment per order", unit: "EUR", defaultValue: 8.5, min: 0 }],
      compute: (v) => {
        const aov = A.averageOrderValue(v.revenue, v.orders);
        const c = A.marketingContribution({ revenue: v.revenue, grossMargin: pct(v.gm), orders: v.orders, fulfilmentPerOrder: v.fulfil, paymentFeeRate: pct(v.fee), spend: v.spend });
        return [
          { label: "ROAS", value: A.roas(v.revenue, v.spend), format: "ratio", formula: "Revenue / spend" },
          { label: "Break-even ROAS", value: A.breakEvenRoas({ grossMargin: pct(v.gm), paymentFeeRate: pct(v.fee), fulfilmentPerOrder: v.fulfil, aov }), format: "ratio", formula: "1 / (GM − fees − fulfilment/AOV)" },
          { label: "Marketing contribution", value: c, format: "currency", formula: "Rev × GM − fees − fulfilment − spend" },
          { label: "Contribution per € spent", value: A.marketingEfficiency(c, v.spend), format: "ratio", formula: "Contribution / spend" },
        ];
      } },
    { id: "funnel", title: "Conversion & order value", description: "Funnel efficiency.", fields: [
      { name: "sessions", label: "Sessions", unit: "sessions", defaultValue: 250_000, min: 0 },
      { name: "orders", label: "Orders", unit: "orders", defaultValue: 2_750, min: 0 },
      { name: "revenue", label: "Revenue", unit: "EUR", defaultValue: 214_500, min: 0 },
      { name: "spend", label: "Spend", unit: "EUR", defaultValue: 60_000, min: 0 },
      { name: "newCustomers", label: "New customers", unit: "customers", defaultValue: 2_100, min: 0 }],
      compute: (v) => [
        { label: "Conversion rate", value: A.conversionRate(v.orders, v.sessions), format: "percent", formula: "Orders / sessions" },
        { label: "Average order value", value: A.averageOrderValue(v.revenue, v.orders), format: "currency", formula: "Revenue / orders" },
        { label: "Cost per order", value: A.costPerOrder(v.spend, v.orders), format: "currency", formula: "Spend / orders" },
        { label: "CAC", value: A.marketingCac(v.spend, v.newCustomers), format: "currency", formula: "Spend / new customers" },
      ] },
  ],
  Operations: [
    { id: "ops", title: "Utilisation, yield & unit cost", description: "Single-stage production KPIs.", fields: [
      { name: "capacity", label: "Theoretical capacity", unit: "units", defaultValue: 60_000, min: 0 },
      { name: "processed", label: "Units processed", unit: "units", defaultValue: 54_000, min: 0 },
      { name: "defects", label: "Defective units", unit: "units", defaultValue: 3_000, min: 0 },
      { name: "cost", label: "Total cost", unit: "EUR", defaultValue: 1_600_000, min: 0 }],
      compute: (v) => {
        const good = v.processed - v.defects;
        return [
          { label: "Capacity utilisation", value: A.capacityUtilization(v.processed, v.capacity), format: "percent", formula: "Processed / capacity" },
          { label: "Defect rate", value: A.defectRate(v.defects, v.processed), format: "percent", formula: "Defects / processed" },
          { label: "Yield", value: A.productionYield(good, v.processed), format: "percent", formula: "Good / processed" },
          { label: "Cost per good unit", value: A.costPerGoodUnit(v.cost, good), format: "currency", formula: "Total cost / good units" },
        ];
      } },
    { id: "bottleneck", title: "Bottleneck & delivery", description: "Serial line throughput and on-time delivery.", fields: [
      { name: "a", label: "Stage 1 effective capacity", unit: "units", defaultValue: 64_000, min: 0 },
      { name: "b", label: "Stage 2 effective capacity", unit: "units", defaultValue: 52_000, min: 0 },
      { name: "c", label: "Stage 3 effective capacity", unit: "units", defaultValue: 60_000, min: 0 },
      { name: "onTime", label: "Units shipped on time", unit: "units", defaultValue: 45_000, min: 0 },
      { name: "shipped", label: "Units shipped", unit: "units", defaultValue: 51_000, min: 0 }],
      compute: (v) => {
        const idx = A.bottleneckIndex([v.a, v.b, v.c]);
        return [
          { label: "Line throughput", value: A.serialThroughput([v.a, v.b, v.c]), format: "integer", formula: "min(stage capacities)" },
          { label: "Bottleneck stage", value: idx === null ? null : idx + 1, format: "integer", formula: "Stage with lowest capacity" },
          { label: "On-time delivery", value: A.onTimeDelivery(v.onTime, v.shipped), format: "percent", formula: "On-time / shipped" },
        ];
      } },
  ],
};

function Calculator({ def }: { def: CalcDef }) {
  const schema = React.useMemo(
    () => z.object(Object.fromEntries(def.fields.map((f) => {
      let s = z.number({ error: "Enter a number" });
      if (f.min !== undefined) s = s.min(f.min, `Must be ≥ ${f.min}`);
      if (f.max !== undefined) s = s.max(f.max, `Must be ≤ ${f.max}`);
      return [f.name, s];
    }))),
    [def],
  );
  const { register, watch, formState: { errors } } = useForm<Record<string, number>>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: Object.fromEntries(def.fields.map((f) => [f.name, f.defaultValue])),
  });
  const values = watch();
  const parsed = schema.safeParse(values);
  const outputs = parsed.success ? def.compute(parsed.data as Record<string, number>) : null;
  return (
    <Card>
      <CardHeader><CardTitle>{def.title}</CardTitle><CardDescription>{def.description}</CardDescription></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()} noValidate>
          {def.fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <Label htmlFor={`${def.id}-${f.name}`}>{f.label} <span className="text-muted-foreground/70">({f.unit})</span></Label>
              <Input id={`${def.id}-${f.name}`} type="number" step="any" className="tabular" aria-invalid={!!errors[f.name]} {...register(f.name, { valueAsNumber: true })} />
              <FieldError message={errors[f.name]?.message as string | undefined} />
            </div>
          ))}
        </form>
        <div className="space-y-2" aria-live="polite">
          {outputs ? outputs.map((o) => (
            <div key={o.label} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">{o.label}</span>
                <span className="tabular text-lg font-semibold" data-testid={`calc-${def.id}-${o.label}`}>{formatValue(o.value, o.format)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{o.formula}{o.value === null ? " — undefined for these inputs (e.g. zero denominator)" : ""}</div>
            </div>
          )) : <p className="text-sm text-muted-foreground">Enter valid inputs to see results.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsLab() {
  return (
    <Tabs defaultValue="Financial">
      <TabsList aria-label="Calculator category">{Object.keys(CALCS).map((k) => <TabsTrigger key={k} value={k}>{k}</TabsTrigger>)}</TabsList>
      {Object.entries(CALCS).map(([k, list]) => (
        <TabsContent key={k} value={k} className="space-y-4">{list.map((c) => <Calculator key={c.id} def={c} />)}</TabsContent>
      ))}
    </Tabs>
  );
}
