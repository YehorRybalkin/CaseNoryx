"use client";

import { Table2, LineChart as LineIcon } from "lucide-react";
import * as React from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ValueFormat } from "@/lib/cases/types";
import { fmtEurCompact, formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

type Datum = Record<string, string | number | boolean | null | undefined>;

function axisFormatter(format: ValueFormat) {
  return (v: number) => {
    if (format === "currency" || format === "currencyM") return fmtEurCompact(v);
    if (format === "percent") return `${Math.round(v * 1000) / 10}%`;
    if (format === "ratio") return `${v}x`;
    return new Intl.NumberFormat("en-GB", { notation: "compact" }).format(v);
  };
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

/** Chart wrapper with an accessible table view toggle. */
export function ChartCard({ title, description, children, table, className, actions }: { title: string; description?: string; children: React.ReactNode; table?: { columns: { key: string; label: string; format?: ValueFormat }[]; rows: Datum[] }; className?: string; actions?: React.ReactNode }) {
  const [showTable, setShowTable] = React.useState(false);
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {table ? (
            <button className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2" onClick={() => setShowTable((s) => !s)} aria-label={showTable ? "Show chart" : "Show data table"} title={showTable ? "Show chart" : "Show data table"}>
              {showTable ? <LineIcon className="size-4" /> : <Table2 className="size-4" />}
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {showTable && table ? (
          <div className="max-h-72 overflow-auto">
            <table className="tabular w-full text-xs">
              <thead>
                <tr>{table.columns.map((c) => <th key={c.key} className={cn("border-b border-border px-2 py-1.5 text-left font-medium text-muted-foreground", c.format && "text-right")}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {table.columns.map((c) => (
                      <td key={c.key} className={cn("border-b border-border/60 px-2 py-1", c.format && "text-right")}>
                        {c.format ? formatValue(r[c.key] as number, c.format) : String(r[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function LineChartView({ data, xKey, series, format, height = 260, referenceY }: { data: Datum[]; xKey: string; series: SeriesDef[]; format: ValueFormat; height?: number; referenceY?: { value: number; label: string } }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--axis)" }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} minTickGap={16} />
          <YAxis tick={{ fontSize: 11, fill: "var(--axis)" }} tickLine={false} axisLine={false} tickFormatter={axisFormatter(format)} width={56} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatValue(Number(v), format)} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />}
          {referenceY && <ReferenceLine y={referenceY.value} stroke="var(--axis)" strokeDasharray="4 4" label={{ value: referenceY.label, fontSize: 11, fill: "var(--muted-foreground)", position: "insideTopRight" }} />}
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? SERIES[i % 8]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChartView({ data, xKey, series, format, height = 260, stacked, horizontal, colorByValue }: { data: Datum[]; xKey: string; series: SeriesDef[]; format: ValueFormat; height?: number; stacked?: boolean; horizontal?: boolean; colorByValue?: boolean }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--grid)" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--axis)" }} tickLine={false} axisLine={false} tickFormatter={axisFormatter(format)} />
              <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: "var(--axis)" }} tickLine={false} axisLine={false} width={150} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--axis)" }} tickLine={false} axisLine={{ stroke: "var(--grid)" }} minTickGap={8} />
              <YAxis tick={{ fontSize: 11, fill: "var(--axis)" }} tickLine={false} axisLine={false} tickFormatter={axisFormatter(format)} width={56} />
            </>
          )}
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => formatValue(Number(v), format)} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <ReferenceLine {...(horizontal ? { x: 0 } : { y: 0 })} stroke="var(--axis)" />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? SERIES[i % 8]} stackId={stacked ? "a" : undefined} radius={stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} stroke="var(--surface)" strokeWidth={stacked ? 1 : 0}>
              {colorByValue && series.length === 1
                ? data.map((d, j) => <Cell key={j} fill={Number(d[s.key]) < 0 ? "var(--danger)" : "var(--series-1)"} />)
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RadarChartView({ data, height = 260 }: { data: { skill: string; value: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--grid)" />
          <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--axis)" }} angle={90} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v))}%`} />
          <Radar dataKey="value" name="Score" stroke="var(--series-1)" fill="var(--series-1)" fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
