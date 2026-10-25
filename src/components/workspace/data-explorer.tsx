"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Download, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { sumMoney } from "@/lib/analytics";
import type { CaseDefinition, CellValue, ColumnDef, DatasetDef, Row } from "@/lib/cases/types";
import { downloadText, toCsv } from "@/lib/csv";
import { fmtEur, fmtNumber, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE = 50;
const NUMERIC = new Set(["integer", "number", "currency", "percent", "ratio"]);

export function formatCell(v: CellValue, c: ColumnDef): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  switch (c.type) {
    case "currency": return fmtEur(v, Math.abs(v) < 1000 ? 2 : 0);
    case "percent": return fmtPct(v, 1);
    case "integer": return fmtNumber(v, 0);
    case "ratio": return `${fmtNumber(v, 2)}x`;
    default: return fmtNumber(v, Number.isInteger(v) ? 0 : 2);
  }
}

/** Columns whose totals are meaningful (additive). */
const additive = (c: ColumnDef) => (c.type === "currency" || c.type === "integer") && !/price|rate|per_|speed|seats_per|avg|value$|_size$|backlog|headcount|shifts|nps|months_since|weekly|starting_|ending_customers/.test(c.key);

export function DataExplorer({ def }: { def: CaseDefinition }) {
  const [datasetId, setDatasetId] = React.useState(def.datasets[0].id);
  const ds = def.datasets.find((d) => d.id === datasetId) as DatasetDef;
  const [query, setQuery] = React.useState("");
  const [segments, setSegments] = React.useState<Record<string, string>>({});
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = React.useState(0);
  const [showDefs, setShowDefs] = React.useState(false);

  const selectDataset = (id: string) => {
    setDatasetId(id);
    setSegments({}); setFrom(""); setTo(""); setSort(null); setPage(0); setQuery("");
  };
  // Any filter change returns to the first page.
  const [filterKey, setFilterKey] = React.useState("");
  const currentKey = JSON.stringify([query, segments, from, to, sort]);
  if (filterKey !== currentKey) {
    setFilterKey(currentKey);
    setPage(0);
  }

  const months = React.useMemo(() => (ds.timeKey ? [...new Set(ds.rows.map((r) => String(r[ds.timeKey!])))].sort() : []), [ds]);
  const segmentValues = React.useMemo(
    () => Object.fromEntries((ds.segmentKeys ?? []).filter((k) => k !== ds.timeKey).map((k) => [k, [...new Set(ds.rows.map((r) => String(r[k])))].sort()])),
    [ds],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = ds.rows.filter((r) => {
      for (const [k, v] of Object.entries(segments)) if (v && String(r[k]) !== v) return false;
      if (ds.timeKey) {
        const m = String(r[ds.timeKey]);
        if (from && m < from) return false;
        if (to && m > to) return false;
      }
      if (q && !ds.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
    if (sort) {
      const col = ds.columns.find((c) => c.key === sort.key);
      const num = col && NUMERIC.has(col.type);
      rows = [...rows].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        const cmp = num ? (Number(av ?? -Infinity) - Number(bv ?? -Infinity)) : String(av ?? "").localeCompare(String(bv ?? ""));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [ds, segments, from, to, query, sort]);

  const totals = React.useMemo(
    () => Object.fromEntries(ds.columns.filter(additive).map((c) => [c.key, c.type === "currency" ? sumMoney(filtered.map((r) => r[c.key] as number)) : filtered.reduce((a, r) => a + (Number(r[c.key]) || 0), 0)])),
    [ds, filtered],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null));

  const exportCsv = () => {
    downloadText(`casenoryx-${def.slug}-${ds.id}.csv`, toCsv(ds.columns, filtered as Row[]));
    toast.success(`Exported ${filtered.length.toLocaleString("en-GB")} rows to CSV`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 flex-1">
            <Label htmlFor="dataset">Dataset</Label>
            <Select id="dataset" className="mt-1 md:max-w-md" value={datasetId} onChange={(e) => selectDataset(e.target.value)}>
              {def.datasets.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.rows.length} rows)</option>)}
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">{ds.description} <Badge variant="outline" className="ml-1">Synthetic data</Badge></p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}><Download /> Export CSV</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="relative sm:col-span-2">
              <Label htmlFor="ds-search">Search</Label>
              <Search className="pointer-events-none absolute left-3 top-[30px] size-4 text-muted-foreground" />
              <Input id="ds-search" className="mt-1 pl-9" placeholder="Search all columns…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {Object.entries(segmentValues).map(([k, values]) => {
              const col = ds.columns.find((c) => c.key === k);
              return (
                <div key={k}>
                  <Label htmlFor={`seg-${k}`}>{col?.label ?? k}</Label>
                  <Select id={`seg-${k}`} className="mt-1" value={segments[k] ?? ""} onChange={(e) => setSegments((s) => ({ ...s, [k]: e.target.value }))}>
                    <option value="">All</option>
                    {values.map((v) => <option key={v} value={v}>{v}</option>)}
                  </Select>
                </div>
              );
            })}
            {ds.timeKey ? (
              <>
                <div>
                  <Label htmlFor="ds-from">From</Label>
                  <Select id="ds-from" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)}>
                    <option value="">Start</option>
                    {months.map((m) => <option key={m}>{m}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ds-to">To</Label>
                  <Select id="ds-to" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)}>
                    <option value="">End</option>
                    {months.map((m) => <option key={m}>{m}</option>)}
                  </Select>
                </div>
              </>
            ) : null}
          </div>
          <button className="flex items-center gap-1 text-xs font-medium text-accent" onClick={() => setShowDefs((s) => !s)} aria-expanded={showDefs}>
            <ChevronDown className={cn("size-3.5 transition-transform", showDefs && "rotate-180")} /> Column definitions
          </button>
          {showDefs && (
            <dl className="grid gap-x-6 gap-y-1.5 rounded-lg border border-border bg-surface-2/50 p-3 text-xs sm:grid-cols-2">
              {ds.columns.map((c) => (
                <div key={c.key}><dt className="inline font-medium">{c.label}{c.unit ? ` (${c.unit})` : ""}:</dt> <dd className="inline text-muted-foreground">{c.description}</dd></div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{filtered.length.toLocaleString("en-GB")} of {ds.rows.length.toLocaleString("en-GB")} rows</CardTitle>
          {pages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="tabular">Page {page + 1} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState title="No rows match the filters" description="Adjust the search, segment or period filters." />
          ) : (
            <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
              <table className="tabular w-full border-collapse text-xs" data-testid="data-table">
                <thead className="sticky top-0 z-10 bg-surface-2">
                  <tr>
                    {ds.columns.map((c) => {
                      const numeric = NUMERIC.has(c.type);
                      const active = sort?.key === c.key;
                      return (
                        <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("border-b border-border px-3 py-2 font-medium text-muted-foreground whitespace-nowrap", numeric ? "text-right" : "text-left")}>
                          <button className={cn("inline-flex items-center gap-1 hover:text-foreground", numeric && "flex-row-reverse")} onClick={() => toggleSort(c.key)} title={c.description}>
                            {c.label}
                            {active ? (sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={i} className="hover:bg-surface-2/60">
                      {ds.columns.map((c) => (
                        <td key={c.key} className={cn("border-b border-border/60 px-3 py-1.5 whitespace-nowrap", NUMERIC.has(c.type) && "text-right")}>{formatCell(r[c.key], c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {Object.keys(totals).length > 0 && (
                  <tfoot className="sticky bottom-0 bg-surface-2 font-semibold">
                    <tr>
                      {ds.columns.map((c, i) => (
                        <td key={c.key} className={cn("border-t border-border px-3 py-2 whitespace-nowrap", NUMERIC.has(c.type) && "text-right")}>
                          {c.key in totals ? formatCell(totals[c.key], c) : i === 0 ? "Total (filtered)" : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
