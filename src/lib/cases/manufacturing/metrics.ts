import { capacityUtilization, costPerGoodUnit, defectRate, onTimeDelivery, safeDivide, sumMoney } from "@/lib/analytics";
import { mfgData, type Stage } from "./data";

type F = { from?: string; to?: string };
const inR = (m: string, f: F) => (!f.from || m >= f.from) && (!f.to || m <= f.to);

export function stageSummary(stage: Stage, f: F) {
  const r = mfgData.production.filter((x) => x.stage === stage && inR(x.month, f));
  const s = (k: keyof (typeof r)[number]) => r.reduce((a, x) => a + (x[k] as number), 0);
  return {
    stage,
    availableHours: s("available_hours"),
    unplannedHours: s("unplanned_downtime_hours"),
    runHours: s("run_hours"),
    capacity: s("theoretical_capacity_units"),
    processed: s("units_processed"),
    good: s("good_units"),
    defectRate: defectRate(s("defective_units"), s("units_processed")),
    unplannedShare: safeDivide(s("unplanned_downtime_hours"), s("available_hours")),
    utilization: capacityUtilization(s("units_processed"), s("theoretical_capacity_units")),
    /** Good units the stage could make if fed without limit: run hours × rate × yield. */
    effectiveCapacity: r.reduce((a, x) => a + x.run_hours * x.rated_speed_uph, 0) * (1 - (defectRate(s("defective_units"), s("units_processed")) ?? 0)),
  };
}

export function plantSummary(f: F) {
  const s = mfgData.summary.filter((x) => inR(x.month, f));
  const totalCost = sumMoney(s.map((x) => x.total_cost));
  const good = s.reduce((a, x) => a + x.good_output, 0);
  const shipped = s.reduce((a, x) => a + x.shipped, 0);
  const onTime = s.reduce((a, x) => a + x.on_time, 0);
  return {
    demand: s.reduce((a, x) => a + x.demand, 0),
    good,
    shipped,
    totalCost,
    costPerGoodUnit: costPerGoodUnit(totalCost, good),
    otd: onTimeDelivery(onTime, shipped),
    endBacklog: s.length ? s[s.length - 1].backlog : null,
    months: s.length,
  };
}

export function costBreakdown(f: F) {
  const rows = mfgData.costs.filter((x) => inR(x.month, f));
  const comps = [...new Set(rows.map((r) => r.cost_component))];
  return comps.map((c) => ({ component: c, amount: sumMoney(rows.filter((r) => r.cost_component === c).map((r) => r.amount)) }));
}
