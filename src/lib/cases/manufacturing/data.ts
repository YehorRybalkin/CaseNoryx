/**
 * Case 5 — Kestrel Components (synthetic brake-component plant), 2023–2024.
 * Serial flow: Stamping → CNC machining → Coating & assembly. Output, backlog
 * and on-time delivery are simulated month by month from capacity and demand.
 */
import { round } from "@/lib/analytics/numbers";
import { createRng, monthIndex, monthRange, yearOf } from "../random";

export const MFG_SEED = 31_415;
export const MFG_MONTHS = monthRange(2023, 1, 24);
export const STAGES = ["Stamping", "CNC machining", "Coating & assembly"] as const;
export type Stage = (typeof STAGES)[number];
export const AVG_SELLING_PRICE = 38.5;
export const WAGE = 29; // EUR per regular hour
export const OVERTIME_PREMIUM = 1.5;
export const SCRAP_COST = { Stamping: 2.9, "CNC machining": 9.5, "Coating & assembly": 14.2 } as const; // EUR per defective unit
export const REACTIVE_REPAIR_PER_HOUR = 880;
export const EXPEDITE_PER_LATE_UNIT = 2.4;
export const OVERHEAD_MONTHLY = 405_000;

const WORKDAYS = [21, 20, 22, 20, 21, 21, 22, 15, 21, 22, 21, 18]; // Aug: plant holiday
const STAGE_PARAMS: Record<Stage, { shifts: number; rate: number; crew: number; plannedPct: number; energyPerHour: number }> = {
  Stamping: { shifts: 2, rate: 225, crew: 14, plannedPct: 0.05, energyPerHour: 95 },
  "CNC machining": { shifts: 3, rate: 121, crew: 18, plannedPct: 0.04, energyPerHour: 140 },
  "Coating & assembly": { shifts: 2, rate: 215, crew: 22, plannedPct: 0.05, energyPerHour: 110 },
};
const SEGMENTS = [["OEM", 0.55], ["Tier-1", 0.3], ["Aftermarket", 0.15]] as const;

export interface ProductionRow {
  month: string; year: number; stage: Stage; shifts_per_day: number;
  available_hours: number; planned_downtime_hours: number; unplanned_downtime_hours: number; overtime_run_hours: number; run_hours: number;
  rated_speed_uph: number; theoretical_capacity_units: number; units_processed: number; defective_units: number; good_units: number;
}

export function generateMfgData() {
  const rng = createRng(MFG_SEED);
  const production: ProductionRow[] = [];
  const labor: { month: string; stage: Stage; headcount: number; regular_hours: number; overtime_hours: number; labor_cost: number }[] = [];
  const maintenance: { month: string; stage: Stage; preventive_hours: number; breakdowns: number; preventive_spend: number; reactive_repair_spend: number }[] = [];
  const costs: { month: string; cost_component: string; amount: number }[] = [];
  const orders: { month: string; customer_segment: string; ordered_units: number; shipped_on_time: number; shipped_late: number; backlog_end: number }[] = [];
  const suppliers: { month: string; steel_supplier: string; material_cost_per_unit: number; incoming_reject_rate: number }[] = [];
  const summary: { month: string; demand: number; good_output: number; shipped: number; on_time: number; late: number; backlog: number; total_cost: number }[] = [];

  let backlog = 1_200;
  let fgInventory = 2_500;
  for (const month of MFG_MONTHS) {
    const y = yearOf(month);
    const mi = monthIndex(month) - 1;
    const days = WORKDAYS[mi];
    const pmCut = month >= "2024-02"; // preventive maintenance budget cut
    const newSupplier = month >= "2024-05"; // cheaper steel supplier
    const demandBase = (y === 2023 ? 51_500 : 53_600) * (days / 20.5) * rng.noise(0.03);
    const demand = Math.round(demandBase);

    // Stage-by-stage flow
    let input = Infinity;
    const stageGood: number[] = [];
    let overtimeB = 0;
    for (const stage of STAGES) {
      const p = STAGE_PARAMS[stage];
      const available = p.shifts * 8 * days;
      const planned = round(available * (stage === "CNC machining" && pmCut ? 0.022 : p.plannedPct), 1);
      let unplannedPct = stage === "CNC machining" ? 0.05 : 0.035;
      if (stage === "CNC machining" && pmCut) {
        const monthsSince = (y - 2024) * 12 + mi - 1; // 0 in Feb 2024
        unplannedPct = Math.min(0.165, 0.06 + 0.012 * monthsSince);
      }
      const unplanned = round(available * unplannedPct * rng.noise(0.08), 1);
      // Weekend overtime on the CNC cell once backlog builds
      const overtime = stage === "CNC machining" && backlog > 2_000 ? Math.min(84, Math.round(backlog / 90)) : 0;
      if (stage === "CNC machining") overtimeB = overtime;
      const run = round(available - planned - unplanned + overtime, 1);
      const capacity = run * p.rate * rng.noise(0.01);
      const target = stage === "Stamping" ? Math.max(0, demand + backlog - fgInventory) * 1.02 : input;
      const processed = Math.round(Math.max(0, Math.min(capacity, target)));
      let defectRate = stage === "Stamping" ? 0.012 : stage === "CNC machining" ? 0.018 : 0.011;
      if (newSupplier && stage !== "Stamping") defectRate = stage === "CNC machining" ? 0.056 : 0.029;
      const defects = Math.round(processed * defectRate * rng.noise(0.06));
      const good = processed - defects;
      stageGood.push(good);
      input = good;
      production.push({
        month, year: y, stage, shifts_per_day: p.shifts,
        available_hours: available, planned_downtime_hours: planned, unplanned_downtime_hours: unplanned, overtime_run_hours: overtime, run_hours: run,
        rated_speed_uph: p.rate, theoretical_capacity_units: available * p.rate, units_processed: processed, defective_units: defects, good_units: good,
      });
      const regular = p.crew * p.shifts * 8 * days;
      const otHours = stage === "CNC machining" ? overtime * p.crew : 0;
      labor.push({ month, stage, headcount: p.crew * p.shifts, regular_hours: regular, overtime_hours: round(otHours, 1), labor_cost: round((regular + otHours * OVERTIME_PREMIUM) * WAGE, 2) });
      const breakdowns = Math.max(0, Math.round(unplanned / (stage === "CNC machining" ? 9 : 12)));
      maintenance.push({
        month, stage,
        preventive_hours: planned,
        breakdowns,
        preventive_spend: round((stage === "CNC machining" ? (pmCut ? 21_000 : 52_000) : 22_000) * rng.noise(0.03), 2),
        reactive_repair_spend: round(unplanned * REACTIVE_REPAIR_PER_HOUR * rng.noise(0.05), 2),
      });
    }
    const goodOutput = stageGood[2];
    // Ship FIFO: backlog first (late), then this month's orders (on time)
    let available = goodOutput + fgInventory;
    const late = Math.min(backlog, available);
    available -= late;
    const onTime = Math.min(demand, available);
    available -= onTime;
    const newBacklog = backlog - late + (demand - onTime);
    fgInventory = Math.min(available, 3_000); // excess good output beyond buffer is not produced in practice
    backlog = newBacklog;

    const started = production.find((r) => r.month === month && r.stage === "Stamping")!.units_processed;
    const materialPerUnit = newSupplier ? 3.86 : 4.12;
    suppliers.push({ month, steel_supplier: newSupplier ? "Supplier Y (since May 2024)" : "Supplier X", material_cost_per_unit: materialPerUnit, incoming_reject_rate: newSupplier ? round(0.021 * rng.noise(0.1), 4) : round(0.006 * rng.noise(0.1), 4) });
    const monthProd = production.filter((r) => r.month === month);
    const scrap = monthProd.reduce((a, r) => a + r.defective_units * SCRAP_COST[r.stage], 0);
    const energy = monthProd.reduce((a, r) => a + r.run_hours * STAGE_PARAMS[r.stage].energyPerHour * (y === 2024 ? 1.03 : 1), 0);
    const maint = maintenance.filter((r) => r.month === month).reduce((a, r) => a + r.preventive_spend + r.reactive_repair_spend, 0);
    const lab = labor.filter((r) => r.month === month).reduce((a, r) => a + r.labor_cost, 0);
    const lines: [string, number][] = [
      ["Materials", started * materialPerUnit],
      ["Direct labour", lab],
      ["Energy", energy],
      ["Maintenance", maint],
      ["Scrap & rework", scrap],
      ["Expedited freight", late * EXPEDITE_PER_LATE_UNIT],
      ["Plant overhead", OVERHEAD_MONTHLY],
    ];
    let total = 0;
    for (const [cost_component, amount] of lines) {
      const a = round(amount, 2);
      total += a;
      costs.push({ month, cost_component, amount: a });
    }
    // Allocate to customer segments (largest-remainder to keep totals exact)
    const alloc = (n: number) => {
      const raw = SEGMENTS.map(([, s]) => n * s);
      const fl = raw.map(Math.floor);
      let rem = n - fl.reduce((a, b) => a + b, 0);
      const order = raw.map((r, i) => [r - fl[i], i] as const).sort((a, b) => b[0] - a[0]);
      for (const [, i] of order) if (rem-- > 0) fl[i]++;
      return fl;
    };
    const [d, ot, lt, bl] = [alloc(demand), alloc(onTime), alloc(late), alloc(newBacklog)];
    SEGMENTS.forEach(([seg], i) => orders.push({ month, customer_segment: seg, ordered_units: d[i], shipped_on_time: ot[i], shipped_late: lt[i], backlog_end: bl[i] }));
    summary.push({ month, demand, good_output: goodOutput, shipped: late + onTime, on_time: onTime, late, backlog: newBacklog, total_cost: round(total, 2) });
    void overtimeB;
  }
  return { production, labor, maintenance, costs, orders, suppliers, summary };
}

export const mfgData = generateMfgData();
