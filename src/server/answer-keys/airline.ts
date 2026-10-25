import "server-only";
import { round } from "@/lib/analytics";
import { BASE_ASSUMPTIONS as B, routePnl } from "@/lib/cases/airline/model";
import { fmtEurM, fmtPct } from "@/lib/format";
import type { AnswerKey } from "./types";

function facts() {
  const base = routePnl(B);
  const low = routePnl({ ...B, demandChange: -0.15 });
  const high = routePnl({ ...B, demandChange: 0.12 });
  const seasonal = routePnl({ ...B, winterFrequency: 0 });
  const seasonalLow = routePnl({ ...B, winterFrequency: 0, demandChange: -0.15 });
  const fuelHigh = routePnl({ ...B, fuelPrice: 1020 });
  const seasonalFuelHigh = routePnl({ ...B, winterFrequency: 0, fuelPrice: 1020 });
  const runRate = routePnl({ ...B, includeOneOffs: false });
  const seasonalRunRate = routePnl({ ...B, winterFrequency: 0, includeOneOffs: false });
  const winterIdx = [0, 1, 2, 10, 11];
  const winterContribution = winterIdx.reduce((a, i) => a + base.months[i].contribution, 0);
  const negativeMonths = base.months.filter((m) => m.contribution < 0).map((m) => m.month);
  return { base, low, high, seasonal, seasonalLow, fuelHigh, seasonalFuelHigh, runRate, seasonalRunRate, winterContribution, negativeMonths };
}
export const airlineFacts = facts();
const F = airlineFacts;
const pct = (x: number | null) => round((x ?? 0) * 100, 2);
const m = (x: number) => round(x / 1e6, 2);

export const airlineAnswerKey: AnswerKey = {
  slug: "airline-route",
  mainProblem: `The year-round plan loses ${fmtEurM(Math.abs(F.base.operatingResult))} in year 1: forecast load factor ${fmtPct(F.base.loadFactor)} is below the break-even ${fmtPct(F.base.breakEvenLf)}, because winter months cannot cover sector costs. A seasonal (Apr–Oct) operation is marginally positive but remains exposed to demand and fuel risk.`,
  rootCauses: [
    {
      id: "winter",
      title: "Winter months destroy value",
      explanation: `Nov–Mar contribution is ${fmtEurM(F.winterContribution)} at 3 weekly round trips: low demand and low fares cannot cover block-hour and departure costs.`,
      evidence: ["Monthly contribution from the forecast and unit-cost tables", "Survey: only 14% would travel Nov–Mar"],
      driverIds: ["winter_losses"],
      concepts: [["winter", "nov", "off-peak", "off-season", "low season", "december", "january", "february"], ["loss", "negative", "contribution", "unprofitable", "value", "below", "cannot cover", "destroy"]],
      weight: 0.35,
    },
    {
      id: "breakeven",
      title: "Break-even load factor above forecast",
      explanation: `Year-round break-even LF is ${fmtPct(F.base.breakEvenLf)} versus a forecast of ${fmtPct(F.base.loadFactor)}; seasonal operation lowers break-even to ${fmtPct(F.seasonal.breakEvenLf)} against ${fmtPct(F.seasonal.loadFactor)} forecast.`,
      evidence: ["Break-even LF = (sector costs + fixed) / (seats × (fare − per-pax costs))"],
      driverIds: ["be_above_forecast"],
      concepts: [["break-even", "breakeven", "break even"], ["load factor", "lf", "%"]],
      weight: 0.3,
    },
    {
      id: "risk",
      title: "Downside risk from demand and fuel",
      explanation: `A 15% demand shortfall moves the year-round result to ${fmtEurM(F.low.operatingResult)} and the seasonal result to ${fmtEurM(F.seasonalLow.operatingResult)}; fuel at €1,020/t costs ${fmtEurM(F.base.operatingResult - F.fuelHigh.operatingResult)} year-round.`,
      evidence: ["Demand low case in the forecast table", "Fuel scenarios table"],
      driverIds: ["demand_risk", "fuel_sensitivity"],
      concepts: [["demand", "fuel", "downside", "sensitiv", "scenario", "risk"], ["loss", "negative", "result", "impact", "drop", "fall", "worse", "%"]],
      weight: 0.35,
    },
  ],
  driverClassification: {
    winter_losses: "root",
    be_above_forecast: "root",
    demand_risk: "root",
    fuel_sensitivity: "contributing",
    launch_costs: "contributing",
    summer_capacity: "distractor",
    competitor_fares: "distractor",
    crew_costs: "distractor",
  },
  quantAnswers: {
    revenue: { value: m(F.base.revenue), tolerance: { abs: 0.15 }, explanation: "Σ min(demand, 95% seats) × base fare, Jan–Dec 2026" },
    loadFactor: { value: pct(F.base.loadFactor), tolerance: { abs: 0.7 }, explanation: "Σ passengers / Σ seats" },
    breakEvenLf: { value: pct(F.base.breakEvenLf), tolerance: { abs: 1.0 }, explanation: "(Σ sector costs + fixed + one-offs) / (Σ seats × (avg fare − per-pax costs))" },
    opResult: { value: m(F.base.operatingResult), tolerance: { abs: 0.15 }, explanation: "Revenue − variable costs − monthly fixed costs − one-off launch costs" },
    opResultLow: { value: m(F.low.operatingResult), tolerance: { abs: 0.15 }, explanation: "Same model with demand −15%" },
    opResultSeasonal: { value: m(F.seasonal.operatingResult), tolerance: { abs: 0.15 }, explanation: "Operate Apr–Oct; suspended months incur only reduced station and insurance costs" },
  },
  keyFacts: [
    { id: "rev", label: "Revenue (base)", value: m(F.base.revenue), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "lf", label: "Load factor (base)", value: pct(F.base.loadFactor), kind: "percent", tolerance: { abs: 0.7 } },
    { id: "be", label: "Break-even LF (year-round)", value: pct(F.base.breakEvenLf), kind: "percent", tolerance: { abs: 1 } },
    { id: "be_rr", label: "Break-even LF (run-rate)", value: pct(F.runRate.breakEvenLf), kind: "percent", tolerance: { abs: 1 } },
    { id: "be_s", label: "Break-even LF (seasonal)", value: pct(F.seasonal.breakEvenLf), kind: "percent", tolerance: { abs: 1 } },
    { id: "lf_s", label: "Load factor (seasonal)", value: pct(F.seasonal.loadFactor), kind: "percent", tolerance: { abs: 0.7 } },
    { id: "op", label: "Operating result (year-round)", value: m(F.base.operatingResult), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "op_low", label: "Operating result (low demand)", value: m(F.low.operatingResult), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "op_s", label: "Operating result (seasonal)", value: m(F.seasonal.operatingResult), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "op_s_rr", label: "Seasonal run-rate result", value: m(F.seasonalRunRate.operatingResult), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "op_s_low", label: "Seasonal result (low demand)", value: m(F.seasonalLow.operatingResult), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "contrib", label: "Contribution (year-round)", value: m(F.base.contribution), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "winter", label: "Winter contribution", value: m(F.winterContribution), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "fuel", label: "Fuel-high result", value: m(F.fuelHigh.operatingResult), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "oneoff", label: "One-off launch costs", value: 0.53, kind: "eur", tolerance: { abs: 0.03 } },
  ],
  recommendationThemes: [
    { id: "seasonal", title: "Launch as a seasonal (Apr–Oct) route rather than year-round", concepts: [["seasonal", "summer", "apr", "suspend", "winter"], ["launch", "operat", "only", "schedule", "route", "pause", "suspend", "cut"]], weight: 0.35 },
    { id: "conditions", title: "Set go/no-go triggers (bookings, LF, fuel) and an exit option", concepts: [["trigger", "threshold", "milestone", "review", "kpi", "booking", "advance sales", "stage", "gate", "exit"], ["load factor", "lf", "booking", "demand", "fuel", "result", "launch", "%"]], weight: 0.25 },
    { id: "hedge", title: "Hedge fuel / build in fuel surcharges", concepts: [["fuel"], ["hedg", "surcharge", "lock", "contract", "pass through", "pass-through"]], weight: 0.15 },
    { id: "revenue", title: "Improve revenue quality (fares, ancillaries, partnerships)", concepts: [["fare", "price", "ancillar", "tour operator", "partner", "block", "yield", "revenue management"], ["increas", "improve", "sell", "agreement", "deal", "raise", "optimi", "higher"]], weight: 0.15 },
    { id: "costs", title: "Reduce launch and fixed costs / airport incentives", concepts: [["airport", "incentive", "launch", "marketing", "discount", "rebate", "fixed"], ["negotiat", "reduc", "cut", "lower", "secure", "incentive"]], weight: 0.1 },
  ],
  antiPatterns: [
    { id: "go_yearround", description: "Approving the year-round plan unconditionally despite a loss at base case.", concepts: [["year-round", "year round", "all year", "12 months"], ["launch", "approve", "go ahead", "recommend", "proceed"]] },
  ],
  alternativeInterpretations: [
    "A strategic case for year-round operation exists (slot protection, brand presence) but should be priced as an explicit investment with a cap and a time limit.",
    "Not launching at all is defensible given that the seasonal result turns negative in the low-demand case; a staged launch with booking triggers is the more balanced answer.",
  ],
  commonMistakes: [
    "Using seat capacity instead of passengers for revenue, or ignoring the 95% LF ceiling.",
    "Comparing break-even LF without including fixed and one-off costs (or mixing year-1 and run-rate).",
    "Treating survey intent shares as demand forecasts.",
    "Averaging monthly load factors instead of Σ passengers / Σ seats.",
  ],
  modelRecommendation: {
    executiveSummary: `Do not launch AAR–AGP year-round: the base case loses ${fmtEurM(Math.abs(F.base.operatingResult))} in year 1 because the ${fmtPct(F.base.loadFactor)} forecast load factor sits below the ${fmtPct(F.base.breakEvenLf)} break-even. Launch instead as an April–October seasonal route (year 1 ${fmtEurM(F.seasonal.operatingResult)}, run-rate ${fmtEurM(F.seasonalRunRate.operatingResult)}), conditional on advance bookings, fuel hedging and a tour-operator seat block.`,
    diagnosis: `Summer months generate strong contribution; Nov–Mar contribution is ${fmtEurM(F.winterContribution)} at 3 weekly round trips. The route therefore only works seasonally, and even then the margin of safety is thin.`,
    rootCauses: `1) Winter demand and fares too low to cover sector costs.\n2) Year-round break-even LF ${fmtPct(F.base.breakEvenLf)} vs forecast ${fmtPct(F.base.loadFactor)}.\n3) Downside: −15% demand gives ${fmtEurM(F.low.operatingResult)} year-round and ${fmtEurM(F.seasonalLow.operatingResult)} seasonal; fuel at €1,020/t gives ${fmtEurM(F.fuelHigh.operatingResult)}.`,
    quantitativeEvidence: `Revenue ${fmtEurM(F.base.revenue)}, contribution ${fmtEurM(F.base.contribution)}, one-offs €0.53m. Seasonal break-even LF ${fmtPct(F.seasonal.breakEvenLf)} vs forecast ${fmtPct(F.seasonal.loadFactor)}.`,
    recommendedActions: "1) Operate Apr–Oct only; redeploy the aircraft to charter in winter.\n2) Gate the launch on 35% of summer seats sold 90 days before first flight.\n3) Hedge 60–70% of FY2026 fuel.\n4) Pre-sell a seat block to a Jutland tour operator to de-risk peak loads.\n5) Negotiate airport launch incentives to offset one-off costs.",
    financialImpact: `Seasonal operation improves year 1 by ${fmtEurM(F.seasonal.operatingResult - F.base.operatingResult)} versus the year-round plan and yields ${fmtEurM(F.seasonalRunRate.operatingResult)} p.a. from year 2 at base assumptions.`,
    implementationPriorities: "Now: board decision on seasonal format and launch gates. T−6 months: open sales, fuel hedge, airport incentive. T−90 days: go/no-go on booking threshold. Post-season: review winter test (e.g. Christmas/Easter specials).",
    risks: "Demand shortfall (seasonal result turns negative at −15% demand), fuel spikes, competitor capacity response; mitigate via booking gates, hedging and a pre-agreed exit after season 1.",
  },
  hintTopics: [
    { id: "structure", triggers: ["start", "structure", "how", "approach", "launch", "decision"], question: "What has to be true for this route to make money, and how would you test each condition?", hints: ["Build a monthly P&L: passengers × fare minus costs driven by block hours, departures and passengers.", "Then compare monthly contribution across the year — is the problem uniform?"], method: "A route decision is an investment decision: revenue forecast → variable costs → contribution → fixed and one-off costs → operating result, then sensitivity analysis on the most uncertain drivers." },
    { id: "breakeven", triggers: ["break", "breakeven", "load factor", "lf"], question: "At what load factor does the route exactly cover all its costs — and how does that compare with the forecast?", hints: ["Separate sector-driven costs from passenger-driven costs.", "Break-even LF = (sector costs + fixed costs) / (seats × (average fare − per-passenger cost))."], method: "The break-even load factor converts the cost base into the share of seats that must be sold. Compare it with the forecast LF: the gap is your margin of safety." },
    { id: "winter", triggers: ["winter", "season", "month", "summer"], question: "Which months create value and which destroy it?", hints: ["Compute contribution by month.", "What happens to the full-year result if the negative-contribution months are not flown?"], method: "Monthly contribution analysis reveals whether a route should be seasonal. Months with negative contribution are only worth flying for strategic reasons." },
    { id: "sensitivity", triggers: ["sensitiv", "risk", "fuel", "demand", "downside", "scenario"], question: "Which single assumption, if wrong, would most damage the case?", hints: ["Run the low-demand case and the high-fuel case separately.", "Compare their impact on the operating result for both year-round and seasonal operation."], method: "Sensitivity analysis changes one driver at a time; scenario analysis combines them. Present the results as a tornado or a small table and tie each risk to a mitigation." },
  ],
};
