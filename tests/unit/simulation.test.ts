import { describe, expect, it } from "vitest";
import { CASES, getCase } from "@/lib/cases/registry";
import { defaultInputs, normaliseInputs, simulate } from "@/lib/simulation";
import { pnl } from "@/lib/cases/retail/metrics";
import { retailData } from "@/lib/cases/retail/data";

describe("scenario engine", () => {
  it("default levers reproduce the baseline for every case", () => {
    for (const c of CASES) {
      const r = simulate(c.slug, defaultInputs(c));
      for (const m of c.scenario.metrics) {
        const b = r.baseline[m.id], s = r.scenario[m.id];
        if (b === null || s === null) expect(s).toBe(b);
        else expect(s).toBeCloseTo(b as number, 6);
      }
    }
  });
  it("is deterministic", () => {
    const def = getCase("saas-churn")!;
    const x = { ...defaultInputs(def), smbChurnReduction: 25 };
    expect(simulate(def.slug, x)).toEqual(simulate(def.slug, x));
  });
  it("clamps and fills lever inputs", () => {
    const def = getCase("retail-profitability")!;
    const n = normaliseInputs(def, { elecPrice: 999, mixShift: Number.NaN });
    expect(n.elecPrice).toBe(12);
    expect(n.mixShift).toBe(0);
    expect(n.opexSavings).toBe(0);
  });
  it("retail baseline matches FY2024 actuals", () => {
    const def = getCase("retail-profitability")!;
    const r = simulate(def.slug, defaultInputs(def));
    const actual = pnl(retailData.sales.filter((s) => s.year === 2024), retailData.opex.filter((s) => s.year === 2024));
    expect(Math.abs((r.baseline.netSales as number) - actual.netSales) / actual.netSales).toBeLessThan(0.001);
    expect(Math.abs((r.baseline.operatingProfit as number) - actual.operatingProfit)).toBeLessThan(150_000);
  });
  it("levers move outcomes in the economically expected direction", () => {
    const run = (slug: string, patch: Record<string, number>) => {
      const def = getCase(slug)!;
      return simulate(def.slug, { ...defaultInputs(def), ...patch });
    };
    const r1 = run("retail-profitability", { elecCost: 5 });
    expect(r1.scenario.operatingProfit!).toBeGreaterThan(r1.baseline.operatingProfit!);
    const r2 = run("retail-profitability", { apparelReturns: -4 });
    expect(r2.scenario.grossProfit!).toBeGreaterThan(r2.baseline.grossProfit!);
    const s1 = run("saas-churn", { smbChurnReduction: 30 });
    expect(s1.scenario.contribution!).toBeGreaterThan(s1.baseline.contribution!);
    expect(s1.scenario.smbChurn!).toBeLessThan(s1.baseline.smbChurn!);
    const a1 = run("airline-route", { winterFrequency: 0 });
    expect(a1.scenario.operatingResult!).toBeGreaterThan(a1.baseline.operatingResult!);
    const a2 = run("airline-route", { fuelPrice: 1100 });
    expect(a2.scenario.operatingResult!).toBeLessThan(a2.baseline.operatingResult!);
    const e1 = run("ecommerce-marketing", { displayBudget: -70 });
    expect(e1.scenario.incrementalContribution!).toBeGreaterThan(e1.baseline.incrementalContribution!);
    expect(e1.scenario.spend!).toBeLessThan(e1.baseline.spend!);
    const m1 = run("manufacturing-ops", { downtimeReduction: 60 });
    expect(m1.scenario.otd!).toBeGreaterThan(m1.baseline.otd!);
    expect(m1.scenario.costPerGoodUnit!).toBeLessThan(m1.baseline.costPerGoodUnit!);
  });
});
