import { safeDivide } from "@/lib/analytics";
import { AVG_SELLING_PRICE, EXPEDITE_PER_LATE_UNIT, OVERHEAD_MONTHLY, OVERTIME_PREMIUM, REACTIVE_REPAIR_PER_HOUR, SCRAP_COST, WAGE, mfgData } from "@/lib/cases/manufacturing/data";
import type { ScenarioResult } from "@/lib/cases/types";

const H2 = (m: string) => m >= "2024-07";
const CNC_CREW_PER_SHIFT = 18;
const MAX_OVERTIME_HOURS_MONTH = 84;

function base() {
  const p = (stage: string) => mfgData.production.filter((r) => H2(r.month) && r.stage === stage);
  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
  const b = p("CNC machining");
  const c = p("Coating & assembly");
  const a = p("Stamping");
  const months = b.length;
  const costs = mfgData.costs.filter((r) => H2(r.month));
  const cost = (k: string) => sum(costs.filter((r) => r.cost_component === k), (r) => r.amount) / months;
  const labor = mfgData.labor.filter((r) => H2(r.month));
  return {
    demand: sum(mfgData.summary.filter((s) => H2(s.month)), (s) => s.demand) / months,
    backlog: mfgData.summary.filter((s) => H2(s.month)).at(-1)!.backlog,
    bAvailable: sum(b, (r) => r.available_hours) / months,
    bPlanned: sum(b, (r) => r.planned_downtime_hours) / months,
    bUnplanned: sum(b, (r) => r.unplanned_downtime_hours) / months,
    rate: b[0].rated_speed_uph,
    dB: sum(b, (r) => r.defective_units) / sum(b, (r) => r.units_processed),
    dC: sum(c, (r) => r.defective_units) / sum(c, (r) => r.units_processed),
    dA: sum(a, (r) => r.defective_units) / sum(a, (r) => r.units_processed),
    materialPerUnit: cost("Materials") / (sum(a, (r) => r.units_processed) / months),
    regularLabor: sum(labor, (r) => r.regular_hours * WAGE) / months,
    energyPerBHour: cost("Energy") / (sum(b, (r) => r.run_hours) / months), // energy scales with line run time
    preventive: sum(mfgData.maintenance.filter((r) => H2(r.month)), (r) => r.preventive_spend) / months,
    otherReactive: sum(mfgData.maintenance.filter((r) => H2(r.month) && r.stage !== "CNC machining"), (r) => r.reactive_repair_spend) / months,
  };
}
const B = base();

export interface MfgInputs {
  downtimeReduction: number;
  defectReduction: number;
  speedIncrease: number;
  programCost: number; // EUR thousands per year
}

function run(x: MfgInputs) {
  const unplanned = B.bUnplanned * (1 - x.downtimeReduction / 100);
  const rate = B.rate * (1 + x.speedIncrease / 100);
  const dB = B.dB * (1 - x.defectReduction / 100);
  const dC = B.dC * (1 - x.defectReduction / 100);
  const goodPerHour = rate * (1 - dB) * (1 - dC);
  const regularRun = B.bAvailable - B.bPlanned - unplanned;

  let backlog = B.backlog;
  let onTime = 0, late = 0, good = 0, overtimeHours = 0, processedB = 0, theoreticalB = 0;
  for (let m = 0; m < 12; m++) {
    const need = B.demand + backlog;
    const regularGood = regularRun * goodPerHour;
    const ot = backlog > 2000 && regularGood < need ? Math.min(MAX_OVERTIME_HOURS_MONTH, (need - regularGood) / goodPerHour) : 0;
    const output = Math.min(need, (regularRun + ot) * goodPerHour);
    const l = Math.min(backlog, output);
    const o = Math.min(B.demand, output - l);
    backlog = backlog - l + (B.demand - o);
    late += l; onTime += o; good += output; overtimeHours += ot;
    processedB += output / ((1 - dB) * (1 - dC));
    theoreticalB += B.bAvailable * rate;
  }
  const startedA = processedB / (1 - B.dA);
  const defectsB = processedB * dB;
  const defectsC = processedB * (1 - dB) * dC;
  const runHours = processedB / rate;
  const cost =
    startedA * B.materialPerUnit +
    B.regularLabor * 12 + overtimeHours * CNC_CREW_PER_SHIFT * WAGE * OVERTIME_PREMIUM +
    runHours * B.energyPerBHour +
    (B.preventive + B.otherReactive) * 12 + unplanned * 12 * REACTIVE_REPAIR_PER_HOUR +
    startedA * B.dA * SCRAP_COST.Stamping + defectsB * SCRAP_COST["CNC machining"] + defectsC * SCRAP_COST["Coating & assembly"] +
    late * EXPEDITE_PER_LATE_UNIT +
    OVERHEAD_MONTHLY * 12;
  const shipped = onTime + late;
  const programCost = x.programCost * 1000;
  return {
    goodOutput: good,
    bottleneckUtilization: safeDivide(processedB, theoreticalB),
    defectRate: dB,
    otd: safeDivide(onTime, shipped),
    endBacklog: backlog,
    costPerGoodUnit: safeDivide(cost + programCost, good),
    operatingProfit: shipped * AVG_SELLING_PRICE - cost - programCost,
  };
}

export function simulateManufacturing(x: MfgInputs): ScenarioResult {
  const baseline = run({ downtimeReduction: 0, defectReduction: 0, speedIncrease: 0, programCost: 0 });
  const scenario = run(x);
  const gain = (scenario.operatingProfit ?? 0) - (baseline.operatingProfit ?? 0) + x.programCost * 1000;
  return {
    baseline: { ...baseline, paybackMonths: null },
    scenario: { ...scenario, paybackMonths: x.programCost > 0 && gain > 0 ? (x.programCost * 1000) / (gain / 12) : null },
    notes: [
      "Baseline = 12-month projection at H2 2024 run-rates (demand, downtime, defect rates, costs), starting from the December 2024 backlog.",
      "CNC machining is the constraint: good output = run hours × rated speed × (1 − CNC defect rate) × (1 − assembly defect rate).",
      `Weekend overtime (up to ${MAX_OVERTIME_HOURS_MONTH} h/month, ${OVERTIME_PREMIUM}× pay for an ${CNC_CREW_PER_SHIFT}-person crew) is used while backlog exceeds 2,000 units.`,
      "Orders ship first-in-first-out: backlog first (late), then current orders (on time).",
      `Revenue at €${AVG_SELLING_PRICE}/unit shipped; program cost is an annual cost of the improvement programme. Payback = programme cost / monthly profit gain before programme cost.`,
    ],
  };
}
