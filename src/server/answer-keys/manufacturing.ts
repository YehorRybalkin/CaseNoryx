import "server-only";
import { round } from "@/lib/analytics";
import { mfgData } from "@/lib/cases/manufacturing/data";
import { costBreakdown, plantSummary, stageSummary } from "@/lib/cases/manufacturing/metrics";
import { fmtEur, fmtEurM, fmtPct } from "@/lib/format";
import { simulateManufacturing } from "@/lib/simulation/manufacturing";
import type { AnswerKey } from "./types";

const Y23 = { from: "2023-01", to: "2023-12" };
const H2 = { from: "2024-07", to: "2024-12" };

function facts() {
  const p23 = plantSummary(Y23), pH2 = plantSummary(H2);
  const cnc23 = stageSummary("CNC machining", Y23), cncH2 = stageSummary("CNC machining", H2);
  const stampH2 = stageSummary("Stamping", H2), asmH2 = stageSummary("Coating & assembly", H2), asm23 = stageSummary("Coating & assembly", Y23);
  const comp = (f: typeof Y23, k: string, months: number) => (costBreakdown(f).find((c) => c.component === k)?.amount ?? 0) / months;
  const materialSavingMonthly = comp(Y23, "Materials", 12) / (stageSummary("Stamping", Y23).processed / 12) - comp(H2, "Materials", 6) / (stampH2.processed / 6);
  const scenario = simulateManufacturing({ downtimeReduction: 60, defectReduction: 50, speedIncrease: 0, programCost: 600 });
  const pmSaving = (52_000 - 21_000) * 6; // H2 preventive saving at CNC
  const reactiveH2 = mfgData.maintenance.filter((r) => r.month >= H2.from && r.stage === "CNC machining").reduce((a, r) => a + r.reactive_repair_spend, 0);
  const reactive23 = mfgData.maintenance.filter((r) => r.month <= Y23.to && r.stage === "CNC machining").reduce((a, r) => a + r.reactive_repair_spend, 0) / 2;
  return {
    p23, pH2, cnc23, cncH2, stampH2, asmH2, asm23, scenario, pmSaving, reactiveH2, reactive23, materialSavingPerUnit: materialSavingMonthly,
    scrapH2: comp(H2, "Scrap & rework", 6) * 6, scrap23H: comp(Y23, "Scrap & rework", 12) * 6,
    overtimeH2: mfgData.labor.filter((r) => r.month >= H2.from).reduce((a, r) => a + r.overtime_hours, 0),
  };
}
export const mfgFacts = facts();
const F = mfgFacts;
const pct = (x: number | null) => round((x ?? 0) * 100, 2);

export const mfgAnswerKey: AnswerKey = {
  slug: "manufacturing-ops",
  mainProblem: `CNC machining is the plant's constraint. Since the February 2024 maintenance cut its unplanned downtime rose from ${fmtPct(F.cnc23.unplannedShare)} to ${fmtPct(F.cncH2.unplannedShare)} of available hours, and since the May 2024 steel switch its defect rate rose from ${fmtPct(F.cnc23.defectRate)} to ${fmtPct(F.cncH2.defectRate)}. Lost bottleneck hours and scrap drove OTD from ${fmtPct(F.p23.otd)} to ${fmtPct(F.pH2.otd)} and cost per good unit from ${fmtEur(F.p23.costPerGoodUnit, 2)} to ${fmtEur(F.pH2.costPerGoodUnit, 2)}.`,
  rootCauses: [
    {
      id: "downtime",
      title: "Unplanned downtime at the CNC bottleneck",
      explanation: `Cutting preventive maintenance at CNC saved about ${fmtEurM(F.pmSaving)} in H2 2024, but unplanned downtime reached ${fmtPct(F.cncH2.unplannedShare)} of available hours and reactive repairs cost ${fmtEurM(F.reactiveH2)} (vs ${fmtEurM(F.reactive23)} in H2-equivalent 2023). Every lost CNC hour is lost plant output.`,
      evidence: ["Production table: CNC unplanned downtime by month", "Maintenance log: preventive hours and breakdowns"],
      driverIds: ["cnc_downtime"],
      concepts: [["downtime", "breakdown", "maintenance", "availability", "unplanned"], ["cnc", "machining", "bottleneck", "constraint", "stage b"]],
      weight: 0.35,
    },
    {
      id: "defects",
      title: "Steel-quality defects consume bottleneck capacity",
      explanation: `After the supplier switch the CNC defect rate rose to ${fmtPct(F.cncH2.defectRate)} and assembly to ${fmtPct(F.asmH2.defectRate)} (from ${fmtPct(F.asm23.defectRate)}). Scrap cost doubled to ${fmtEurM(F.scrapH2)} per half-year and defective parts waste constrained CNC hours; the material saving (≈${fmtEur(F.materialSavingPerUnit, 2)} per unit started) is outweighed.`,
      evidence: ["Production table: defects by stage", "Steel supply table: incoming reject rate"],
      driverIds: ["steel_quality"],
      concepts: [["defect", "scrap", "quality", "reject", "yield"], ["steel", "supplier", "material", "cnc", "machining"]],
      weight: 0.3,
    },
    {
      id: "constraint",
      title: "CNC is the constraint; recovery costs inflate unit cost",
      explanation: `CNC runs at ${fmtPct(F.cncH2.utilization)} utilisation while Stamping (${fmtPct(F.stampH2.utilization)}) and assembly (${fmtPct(F.asmH2.utilization)}) have spare capacity. Weekend overtime (${Math.round(F.overtimeH2).toLocaleString("en-GB")} paid hours in H2), expedited freight and reactive repairs push cost per good unit up.`,
      evidence: ["Utilisation by stage", "Labour table: overtime hours", "Cost table: expedited freight"],
      driverIds: ["bottleneck_cnc", "recovery_costs"],
      concepts: [["bottleneck", "constraint", "slowest", "limiting"], ["cnc", "machining", "throughput", "capacity", "output"]],
      weight: 0.35,
    },
  ],
  driverClassification: {
    cnc_downtime: "root",
    steel_quality: "root",
    bottleneck_cnc: "root",
    recovery_costs: "contributing",
    stamping_util: "distractor",
    demand_surge: "distractor",
    energy: "distractor",
    labour_rates: "distractor",
  },
  quantAnswers: {
    otd2023: { value: pct(F.p23.otd), tolerance: { abs: 0.5 }, explanation: "Σ on-time / Σ shipped, 2023" },
    otdH2: { value: pct(F.pH2.otd), tolerance: { abs: 0.5 }, explanation: "Σ on-time / Σ shipped, Jul–Dec 2024" },
    cncUnplannedH2: { value: pct(F.cncH2.unplannedShare), tolerance: { abs: 0.5 }, explanation: "Σ CNC unplanned downtime / Σ CNC available hours, H2 2024" },
    cncDefectH2: { value: pct(F.cncH2.defectRate), tolerance: { abs: 0.3 }, explanation: "Σ CNC defective / Σ CNC processed, H2 2024" },
    cpgu2023: { value: round(F.p23.costPerGoodUnit!, 2), tolerance: { abs: 0.3 }, explanation: "Total plant cost / good units, 2023" },
    cpguH2: { value: round(F.pH2.costPerGoodUnit!, 2), tolerance: { abs: 0.3 }, explanation: "Total plant cost / good units, H2 2024" },
  },
  keyFacts: [
    { id: "otd23", label: "OTD 2023", value: pct(F.p23.otd), kind: "percent", tolerance: { abs: 0.5 } },
    { id: "otdh2", label: "OTD H2 2024", value: pct(F.pH2.otd), kind: "percent", tolerance: { abs: 0.5 } },
    { id: "ud23", label: "CNC unplanned downtime 2023", value: pct(F.cnc23.unplannedShare), kind: "percent", tolerance: { abs: 0.5 } },
    { id: "udh2", label: "CNC unplanned downtime H2 2024", value: pct(F.cncH2.unplannedShare), kind: "percent", tolerance: { abs: 0.5 } },
    { id: "dr23", label: "CNC defect rate 2023", value: pct(F.cnc23.defectRate), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "drh2", label: "CNC defect rate H2 2024", value: pct(F.cncH2.defectRate), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "cpgu23", label: "Cost per good unit 2023", value: round(F.p23.costPerGoodUnit!, 2), kind: "plain", tolerance: { abs: 0.3 } },
    { id: "cpguh2", label: "Cost per good unit H2 2024", value: round(F.pH2.costPerGoodUnit!, 2), kind: "plain", tolerance: { abs: 0.3 } },
    { id: "utilcnc", label: "CNC utilisation H2", value: pct(F.cncH2.utilization), kind: "percent", tolerance: { abs: 1 } },
    { id: "utilst", label: "Stamping utilisation H2", value: pct(F.stampH2.utilization), kind: "percent", tolerance: { abs: 1 } },
    { id: "backlog", label: "Backlog Dec 2024", value: F.pH2.endBacklog ?? 0, kind: "plain", tolerance: { rel: 0.05 } },
    { id: "scrap", label: "Scrap cost H2 2024", value: round(F.scrapH2 / 1e6, 2), kind: "eur", tolerance: { abs: 0.03 } },
    { id: "reactive", label: "CNC reactive repairs H2 2024", value: round(F.reactiveH2 / 1e6, 2), kind: "eur", tolerance: { abs: 0.03 } },
    { id: "payback", label: "Programme payback (months)", value: round(F.scenario.scenario.paybackMonths ?? 0, 1), kind: "plain", tolerance: { abs: 1 } },
  ],
  recommendationThemes: [
    { id: "pm", title: "Restore preventive maintenance / TPM on the CNC cell", concepts: [["maintenance", "tpm", "preventive", "predictive", "reliability"], ["cnc", "machining", "bottleneck", "restore", "reinstate", "invest"]], weight: 0.3 },
    { id: "steel", title: "Fix steel quality (supplier, incoming inspection, specs)", concepts: [["steel", "supplier", "material", "incoming", "inspection"], ["quality", "revert", "switch", "spec", "audit", "penalt", "dual", "back", "renegotiat", "inspect"]], weight: 0.25 },
    { id: "protect", title: "Protect and exploit the bottleneck (buffers, breaks, quality gates before CNC)", concepts: [["bottleneck", "constraint", "cnc"], ["buffer", "protect", "exploit", "prioriti", "quality gate", "staggered", "breaks", "never idle", "schedule", "smed", "changeover"]], weight: 0.2 },
    { id: "nocapex", title: "Avoid capex on non-constraints / defer new machine until losses recovered", concepts: [["machine", "capex", "capacity", "stamping", "invest"], ["avoid", "not", "defer", "unnecessary", "before", "instead", "first"]], weight: 0.1 },
    { id: "kpi", title: "Manage on cost per good unit, OEE and OTD (total cost, not budget lines)", concepts: [["oee", "cost per good unit", "total cost", "otd", "kpi"], ["track", "manage", "measure", "dashboard", "target", "steer", "monitor", "review"]], weight: 0.15 },
  ],
  antiPatterns: [
    { id: "stamping", description: "Investing to raise Stamping utilisation — it is not the constraint; more stamped parts only add WIP.", concepts: [["stamping"], ["increase utili", "improve utili", "invest", "automat", "more output", "speed up"]] },
    { id: "new_machine", description: "Buying a new CNC machine before recovering the ~10% of hours lost to downtime and the extra defects.", concepts: [["new", "additional", "second", "buy", "purchase"], ["cnc", "machine"]] },
  ],
  alternativeInterpretations: [
    "Keeping Supplier Y with tighter specifications and incoming inspection may be viable if defects can be brought back below ~2.5%; the decision should be based on total cost per good unit.",
    "Adding a fourth CNC shift (weekends) permanently is an alternative to TPM, but at overtime rates it is more expensive per unit than recovering lost hours.",
  ],
  commonMistakes: [
    "Assuming the stage with the lowest utilisation is the problem.",
    "Treating the maintenance and material savings as successes without total-cost analysis.",
    "Ignoring that defects at the constraint waste constraint hours.",
    "Averaging OTD by month instead of Σ on-time / Σ shipped.",
    "Blaming demand growth (only ~5%).",
  ],
  modelRecommendation: {
    executiveSummary: `Kestrel's service and cost problems come from two 2024 savings decisions that hit the CNC bottleneck: OTD fell from ${fmtPct(F.p23.otd)} to ${fmtPct(F.pH2.otd)} and cost per good unit rose to ${fmtEur(F.pH2.costPerGoodUnit, 2)}. Restoring preventive maintenance at CNC and fixing steel quality — a ~€0.6m/yr programme — lifts OTD to about ${fmtPct(F.scenario.scenario.otd)} and pays back in roughly ${(F.scenario.scenario.paybackMonths ?? 0).toFixed(0)} months; no new machine is needed.`,
    diagnosis: "CNC machining is the constraint (highest utilisation, upstream WIP builds). Its effective capacity fell below demand once downtime and defects rose, creating a persistent backlog that is shipped late and recovered with expensive overtime and expedited freight.",
    rootCauses: `1) CNC unplanned downtime ${fmtPct(F.cnc23.unplannedShare)} → ${fmtPct(F.cncH2.unplannedShare)} after the PM cut.\n2) CNC defects ${fmtPct(F.cnc23.defectRate)} → ${fmtPct(F.cncH2.defectRate)} after the steel switch.\n3) Recovery costs (overtime, expedite, reactive repairs) raise cost per good unit.`,
    quantitativeEvidence: `Reactive CNC repairs ${fmtEurM(F.reactiveH2)} in H2 2024 vs PM saving ${fmtEurM(F.pmSaving)}; scrap ${fmtEurM(F.scrapH2)} vs ${fmtEurM(F.scrap23H)} per half-year in 2023; backlog ${Math.round(F.pH2.endBacklog ?? 0).toLocaleString("en-GB")} units at Dec 2024.`,
    recommendedActions: "1) Reinstate CNC preventive maintenance and launch TPM (target −60% unplanned downtime).\n2) Put Supplier Y on corrective action with incoming hardness tests; dual-source back to Supplier X until defect rate < 2.5%.\n3) Add a quality gate before CNC so no defective blanks consume CNC time.\n4) Protect the constraint: staggered breaks, buffer in front of CNC, SMED on changeovers.\n5) Track OEE, cost per good unit and OTD weekly.",
    financialImpact: `Simulator (downtime −60%, defects −50%, €600k/yr): operating profit ${fmtEurM(F.scenario.baseline.operatingProfit)} → ${fmtEurM(F.scenario.scenario.operatingProfit)}, cost per good unit ${fmtEur(F.scenario.baseline.costPerGoodUnit, 2)} → ${fmtEur(F.scenario.scenario.costPerGoodUnit, 2)}, payback ≈ ${(F.scenario.scenario.paybackMonths ?? 0).toFixed(1)} months.`,
    implementationPriorities: "Weeks 0–4: quality gate, supplier corrective action, PM schedule reinstated. Months 2–6: TPM roll-out, SMED. Month 6: decide on supplier and on any capacity investment based on recovered OEE.",
    risks: "Maintenance windows temporarily reduce CNC hours; supplier switch-back raises material cost — manage via phased PM and total-cost tracking.",
  },
  hintTopics: [
    { id: "bottleneck", triggers: ["bottleneck", "constraint", "capacity", "stage", "start", "where"], question: "In a serial line, which stage decides how many good parts leave the plant?", hints: ["Compare utilisation and effective capacity (run hours × speed × yield) of each stage.", "Look where work-in-progress piles up: the stage processing fewer units than it receives."], method: "Theory of constraints: the throughput of a serial process equals the capacity of its slowest stage. Improvements anywhere else do not increase output." },
    { id: "downtime", triggers: ["downtime", "maintenance", "breakdown", "availability"], question: "How has the time the bottleneck actually runs changed, and what changed in early 2024?", hints: ["Plot CNC unplanned downtime hours by month next to preventive maintenance hours and spend."], method: "Availability = (available − downtime) / available. An hour lost at the bottleneck is an hour lost for the entire plant." },
    { id: "quality", triggers: ["defect", "scrap", "quality", "steel", "supplier", "yield"], question: "What does a defective part cost when it is scrapped after the bottleneck?", hints: ["Compare defect rates by stage before and after May 2024.", "Set the material saving per unit against scrap and lost bottleneck capacity."], method: "Cost per good unit = total cost / good units. Defects raise it twice: scrap cost in the numerator and fewer good units in the denominator." },
    { id: "cost", triggers: ["cost", "unit", "overtime", "expedite", "freight"], question: "Which cost lines moved, and are they consequences or causes?", hints: ["Break down cost per good unit by component for 2023 and H2 2024.", "Overtime and expediting appear only after the backlog builds."], method: "Separate primary causes (e.g. lost capacity) from recovery costs (overtime, expediting) that follow from them." },
    { id: "delivery", triggers: ["otd", "delivery", "late", "backlog", "on-time"], question: "Why does a small capacity shortfall cause such a big drop in on-time delivery?", hints: ["Follow the backlog month by month and remember that backlog ships first."], method: "With FIFO shipping, a persistent backlog makes a share of every month's shipments late even when output almost matches demand." },
  ],
};
