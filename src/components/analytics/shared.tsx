"use client";
import * as React from "react";
import { Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3">{children}</div>;
}

export function FilterSelect({ id, label, value, onChange, options, className }: { id: string; label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; className?: string }) {
  return (
    <div className={cn("min-w-36", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} className="mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className={cn("tabular text-xs", tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-muted-foreground")}>{sub}</div> : null}
    </div>
  );
}

export function DataTable({ columns, rows, caption }: { columns: { key: string; label: string; align?: "right" }[]; rows: Record<string, React.ReactNode>[]; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={cn("border-b border-border px-2 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap", c.align === "right" ? "text-right" : "text-left")}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface-2/50">
              {columns.map((c) => <td key={c.key} className={cn("border-b border-border/60 px-2 py-1.5 whitespace-nowrap", c.align === "right" && "text-right")}>{r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function signedTone(x: number | null, higherIsBetter = true): "good" | "bad" | undefined {
  if (x === null || Math.abs(x) < 1e-12) return undefined;
  return (x > 0) === higherIsBetter ? "good" : "bad";
}
