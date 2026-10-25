"use client";

import { Info, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { deleteScenarioAction, saveScenarioAction } from "@/app/actions";
import { BarChartView, ChartCard } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import type { CaseDefinition, ScenarioResult } from "@/lib/cases/types";
import { fmtDateTime, formatDelta, formatValue } from "@/lib/format";
import { defaultInputs, normaliseInputs, simulate, type LeverValues } from "@/lib/simulation";
import { cn } from "@/lib/utils";

export interface SavedScenarioView { id: string; name: string; createdAt: string; inputs: LeverValues; results: ScenarioResult }

export function ScenarioSimulator({ def, saved: initialSaved }: { def: CaseDefinition; saved: SavedScenarioView[] }) {
  const [values, setValues] = React.useState<LeverValues>(() => defaultInputs(def));
  const [saved, setSaved] = React.useState(initialSaved);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const result = React.useMemo(() => simulate(def.slug, normaliseInputs(def, values)), [def, values]);
  const isDefault = def.scenario.levers.every((l) => values[l.id] === l.defaultValue);

  const moneyMetrics = def.scenario.metrics.filter((m) => m.format === "currencyM");
  const chartData = moneyMetrics.map((m) => ({ metric: m.label, Baseline: result.baseline[m.id], Scenario: result.scenario[m.id] }));

  async function save() {
    setSaving(true);
    const res = await saveScenarioAction(def.slug, { name: name.trim() || `Scenario ${saved.length + 1}`, inputs: values });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setSaved((s) => [{ ...res.data, createdAt: new Date(res.data.createdAt).toISOString() }, ...s]);
    setName("");
    toast.success(`Saved scenario “${res.data.name}”`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Decision levers</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setValues(defaultInputs(def))} disabled={isDefault}><RotateCcw /> Reset</Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {def.scenario.levers.map((l) => {
            const v = values[l.id];
            return (
              <div key={l.id}>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`lever-${l.id}`} className="text-foreground">{l.label}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={`lever-${l.id}`}
                      type="number"
                      className="h-7 w-20 text-right tabular"
                      min={l.min}
                      max={l.max}
                      step={l.step}
                      value={v}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) setValues((s) => ({ ...s, [l.id]: Math.min(l.max, Math.max(l.min, n)) }));
                      }}
                    />
                    <span className="w-10 text-xs text-muted-foreground">{l.unit}</span>
                  </div>
                </div>
                <Slider className="mt-2" aria-label={l.label} min={l.min} max={l.max} step={l.step} value={[v]} onValueChange={([n]) => setValues((s) => ({ ...s, [l.id]: n }))} />
                <p className="mt-1 text-[11px] text-muted-foreground">{l.description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader><CardTitle>Baseline vs. scenario</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm" data-testid="scenario-table">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="border-b border-border py-2 text-left font-medium">Metric</th>
                    <th className="border-b border-border py-2 text-right font-medium">Baseline</th>
                    <th className="border-b border-border py-2 text-right font-medium">Scenario</th>
                    <th className="border-b border-border py-2 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {def.scenario.metrics.map((m) => {
                    const b = result.baseline[m.id], s = result.scenario[m.id];
                    const d = b === null || s === null || b === undefined || s === undefined ? null : s - b;
                    const good = d !== null && Math.abs(d) > 1e-9 && (d > 0) === m.higherIsBetter;
                    const bad = d !== null && Math.abs(d) > 1e-9 && !good;
                    return (
                      <tr key={m.id}>
                        <td className="border-b border-border/60 py-2">{m.label}</td>
                        <td className="border-b border-border/60 py-2 text-right text-muted-foreground">{formatValue(b, m.format)}</td>
                        <td className="border-b border-border/60 py-2 text-right font-medium" data-testid={`scenario-${m.id}`}>{formatValue(s, m.format)}</td>
                        <td className={cn("border-b border-border/60 py-2 text-right text-xs font-medium", good && "text-success", bad && "text-danger")}>{formatDelta(d, m.format)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="flex cursor-pointer items-center gap-1 font-medium text-foreground"><Info className="size-3.5" /> Model assumptions</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </details>
          </CardContent>
        </Card>

        {chartData.length > 0 && (
          <ChartCard title="Financial outcome" description="Baseline vs. scenario (EUR)" table={{ columns: [{ key: "metric", label: "Metric" }, { key: "Baseline", label: "Baseline", format: "currencyM" }, { key: "Scenario", label: "Scenario", format: "currencyM" }], rows: chartData }}>
            <BarChartView data={chartData} xKey="metric" format="currency" series={[{ key: "Baseline", label: "Baseline" }, { key: "Scenario", label: "Scenario" }]} height={240} />
          </ChartCard>
        )}

        <Card>
          <CardHeader><CardTitle>Saved scenarios</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Scenario name" placeholder="Scenario name (e.g. Margin recovery plan)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={save} disabled={saving}><Save /> {saving ? "Saving…" : "Save scenario"}</Button>
            </div>
            {saved.length === 0 ? (
              <EmptyState title="No saved scenarios" description="Save scenarios to compare options and cite them in your recommendation." />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {saved.map((s) => {
                  const key = def.scenario.metrics.find((m) => m.format === "currencyM") ?? def.scenario.metrics[0];
                  return (
                    <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDateTime(s.createdAt)} · {def.scenario.levers.filter((l) => s.inputs[l.id] !== l.defaultValue).map((l) => `${l.label}: ${s.inputs[l.id]}${l.unit}`).join(" · ") || "Baseline"}
                        </div>
                        <div className="text-xs">{key.label}: <span className="tabular font-medium">{formatValue(s.results.scenario[key.id], key.format)}</span></div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setValues({ ...defaultInputs(def), ...s.inputs }); toast.success(`Loaded “${s.name}”`); }}><Upload /> Load</Button>
                        <ConfirmDialog
                          trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${s.name}`}><Trash2 /></Button>}
                          title="Delete scenario?"
                          description={<>“{s.name}” will be permanently deleted.</>}
                          confirmLabel="Delete"
                          destructive
                          onConfirm={async () => {
                            const r = await deleteScenarioAction(def.slug, s.id);
                            if (r.ok) { setSaved((xs) => xs.filter((x) => x.id !== s.id)); toast.success("Scenario deleted"); } else toast.error(r.error);
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
