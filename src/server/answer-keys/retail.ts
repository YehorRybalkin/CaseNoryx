import "server-only";
import { pctChange, round, safeDivide, sumMoney } from "@/lib/analytics";
import { retailData } from "@/lib/cases/retail/data";
import { pnl, segmentSummary } from "@/lib/cases/retail/metrics";
import { fmtEurM, fmtPct } from "@/lib/format";
import { simulateRetail } from "@/lib/simulation/retail";
import type { AnswerKey } from "./types";

function facts() {
  const s23 = retailData.sales.filter((s) => s.year === 2023);
  const s24 = retailData.sales.filter((s) => s.year === 2024);
  const o23 = retailData.opex.filter((s) => s.year === 2023);
  const o24 = retailData.opex.filter((s) => s.year === 2024);
  const p23 = pnl(s23, o23);
  const p24 = pnl(s24, o24);
  const c23 = Object.fromEntries(segmentSummary(s23, "category").map((c) => [c.key, c]));
  const c24 = Object.fromEntries(segmentSummary(s24, "category").map((c) => [c.key, c]));
  const opexLine = (o: typeof o23, l: string) => sumMoney(o.filter((x) => x.expense_line === l).map((x) => x.amount));
  const unitCost = (rows: typeof s23) => {
    const r = rows.filter((x) => x.category === "Electronics");
    const units = r.reduce((a, x) => a + x.units_sold, 0);
    const ret = r.reduce((a, x) => a + x.units_returned, 0);
    return sumMoney(r.map((x) => x.cogs)) / (units - ret + ret * 0.25);
  };
  return {
    p23, p24, c23, c24,
    netSalesGrowth: pctChange(p24.netSales, p23.netSales)!,
    opChange: p24.operatingProfit - p23.operatingProfit,
    gmChangePp: p24.grossMargin! - p23.grossMargin!,
    elecPriceChange: pctChange(c24.Electronics.avgPrice, c23.Electronics.avgPrice)!,
    elecCostChange: pctChange(unitCost(s24), unitCost(s23))!,
    elecGpChange: c24.Electronics.grossProfit - c23.Electronics.grossProfit,
    elecSalesGrowth: pctChange(c24.Electronics.netSales, c23.Electronics.netSales)!,
    apparelGpChange: c24.Apparel.grossProfit - c23.Apparel.grossProfit,
    opexChange: p24.opex - p23.opex,
    logisticsChange: opexLine(o24, "Logistics & distribution") - opexLine(o23, "Logistics & distribution"),
    marketingChange: opexLine(o24, "Marketing") - opexLine(o23, "Marketing"),
    staffGrowth: pctChange(opexLine(o24, "Store staff"), opexLine(o23, "Store staff"))!,
    gpChange: p24.grossProfit - p23.grossProfit,
    scenario: simulateRetail({ elecPrice: 4, elecCost: 3, apparelReturns: -4, mixShift: 0, opexSavings: 5 }),
    flowThrough: safeDivide(p24.grossProfit - p23.grossProfit, p24.netSales - p23.netSales)!,
  };
}

export const retailFacts = facts();
const F = retailFacts;
const pct = (x: number) => round(x * 100, 2);
const m = (x: number) => round(x / 1e6, 2);

export const retailAnswerKey: AnswerKey = {
  slug: "retail-profitability",
  mainProblem: `Net sales grew ${fmtPct(F.netSalesGrowth)} but operating profit fell from ${fmtEurM(F.p23.operatingProfit)} to ${fmtEurM(F.p24.operatingProfit)}: growth was bought with electronics price cuts in the group's lowest-margin category, while a free-returns policy eroded apparel profitability.`,
  rootCauses: [
    {
      id: "elec_margin",
      title: "Electronics margin collapse (price erosion + cost inflation)",
      explanation: `The TechDeals programme cut the electronics average selling price by ${fmtPct(Math.abs(F.elecPriceChange))} while unit costs rose ${fmtPct(F.elecCostChange)}. Category gross margin fell from ${fmtPct(F.c23.Electronics.grossMargin)} to ${fmtPct(F.c24.Electronics.grossMargin)}, so electronics gross profit dropped ${fmtEurM(Math.abs(F.elecGpChange))} despite ${fmtPct(F.elecSalesGrowth)} sales growth.`,
      evidence: ["Sales table: electronics avg. selling price and gross margin by month (break in Feb 2024)", "Promotions calendar: TechDeals Feb–Dec 2024"],
      driverIds: ["elec_price", "elec_cost"],
      concepts: [["electronic", "techdeal", "tech deal", "consumer tech"], ["margin", "price", "discount", "promot", "gross profit", "unit cost", "cost"]],
      weight: 0.4,
    },
    {
      id: "mix",
      title: "Mix shift toward the lowest-margin category",
      explanation: `Electronics grew from ${fmtPct(F.c23.Electronics.share)} to ${fmtPct(F.c24.Electronics.share)} of net sales. Because it carries the lowest margin, its growth mechanically dilutes the group gross margin (${fmtPct(F.p23.grossMargin)} → ${fmtPct(F.p24.grossMargin)}).`,
      evidence: ["Category share of net sales FY2023 vs FY2024"],
      driverIds: ["mix"],
      concepts: [["mix", "share", "dilut", "weight", "composition"], ["electronic", "low-margin", "lower margin", "low margin", "lower-margin", "category"]],
      weight: 0.2,
    },
    {
      id: "returns",
      title: "Apparel returns surge after the free-returns policy",
      explanation: `Since free returns launched in March 2024 the apparel return rate rose from ${fmtPct(F.c23.Apparel.returnRate)} to ${fmtPct(F.c24.Apparel.returnRate)}, cutting net sales, adding write-offs of unsaleable stock and handling costs. Apparel gross profit fell ${fmtEurM(Math.abs(F.apparelGpChange))}.`,
      evidence: ["Returns table: apparel return rate step-change in Mar 2024", "Top return reason shifts to 'Changed mind (free returns)'"],
      driverIds: ["returns"],
      concepts: [["return"], ["apparel", "free return", "fashion", "clothing", "policy"]],
      weight: 0.25,
    },
    {
      id: "opex",
      title: "Variable logistics and marketing costs (secondary)",
      explanation: `Opex rose ${fmtEurM(F.opexChange)}, of which logistics ${fmtEurM(F.logisticsChange)} (returns handling and electronics home delivery) and marketing ${fmtEurM(F.marketingChange)}. Store staff grew only ${fmtPct(F.staffGrowth)}, in line with wage inflation.`,
      evidence: ["Opex table by line, FY2023 vs FY2024"],
      driverIds: ["logistics"],
      concepts: [["logistic", "deliver", "handling", "marketing", "opex", "operating expense"], ["increas", "grew", "rise", "rose", "up", "higher", "growth"]],
      weight: 0.15,
    },
  ],
  driverClassification: {
    elec_price: "root",
    elec_cost: "root",
    mix: "root",
    returns: "root",
    logistics: "contributing",
    staff: "distractor",
    east: "distractor",
    rent: "distractor",
    food: "distractor",
    clearance: "distractor",
  },
  quantAnswers: {
    netSalesGrowth: { value: pct(F.netSalesGrowth), tolerance: { abs: 0.3 }, explanation: `(${fmtEurM(F.p24.netSales)} − ${fmtEurM(F.p23.netSales)}) / ${fmtEurM(F.p23.netSales)}` },
    grossMargin2024: { value: pct(F.p24.grossMargin!), tolerance: { abs: 0.3 }, explanation: `Gross profit ${fmtEurM(F.p24.grossProfit)} / net sales ${fmtEurM(F.p24.netSales)}` },
    operatingMargin2024: { value: pct(F.p24.operatingMargin!), tolerance: { abs: 0.3 }, explanation: `Operating profit ${fmtEurM(F.p24.operatingProfit)} / net sales ${fmtEurM(F.p24.netSales)}` },
    opProfitChange: { value: m(F.opChange), tolerance: { abs: 0.3 }, explanation: `${fmtEurM(F.p24.operatingProfit)} − ${fmtEurM(F.p23.operatingProfit)}` },
    elecMargin2024: { value: pct(F.c24.Electronics.grossMargin!), tolerance: { abs: 0.5 }, explanation: "Electronics gross profit / electronics net sales, FY2024" },
    apparelReturn2024: { value: pct(F.c24.Apparel.returnRate!), tolerance: { abs: 0.4 }, explanation: "Apparel units returned / apparel units sold, FY2024" },
  },
  keyFacts: [
    { id: "growth", label: "Net sales growth", value: pct(F.netSalesGrowth), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "gm23", label: "Gross margin FY2023", value: pct(F.p23.grossMargin!), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "gm24", label: "Gross margin FY2024", value: pct(F.p24.grossMargin!), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "gmpp", label: "Gross margin change (pp)", value: pct(F.gmChangePp), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "om23", label: "Operating margin FY2023", value: pct(F.p23.operatingMargin!), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "om24", label: "Operating margin FY2024", value: pct(F.p24.operatingMargin!), kind: "percent", tolerance: { abs: 0.3 } },
    { id: "op23", label: "Operating profit FY2023", value: m(F.p23.operatingProfit), kind: "eur", tolerance: { abs: 0.4 } },
    { id: "op24", label: "Operating profit FY2024", value: m(F.p24.operatingProfit), kind: "eur", tolerance: { abs: 0.4 } },
    { id: "opchg", label: "Operating profit change", value: m(F.opChange), kind: "eur", tolerance: { abs: 0.4 } },
    { id: "egm23", label: "Electronics margin FY2023", value: pct(F.c23.Electronics.grossMargin!), kind: "percent", tolerance: { abs: 0.5 } },
    { id: "egm24", label: "Electronics margin FY2024", value: pct(F.c24.Electronics.grossMargin!), kind: "percent", tolerance: { abs: 0.5 } },
    { id: "eprice", label: "Electronics price change", value: pct(F.elecPriceChange), kind: "percent", tolerance: { abs: 0.7 } },
    { id: "ecost", label: "Electronics unit-cost change", value: pct(F.elecCostChange), kind: "percent", tolerance: { abs: 0.7 } },
    { id: "egp", label: "Electronics gross profit change", value: m(F.elecGpChange), kind: "eur", tolerance: { abs: 0.4 } },
    { id: "eshare23", label: "Electronics share FY2023", value: pct(F.c23.Electronics.share!), kind: "percent", tolerance: { abs: 0.7 } },
    { id: "eshare24", label: "Electronics share FY2024", value: pct(F.c24.Electronics.share!), kind: "percent", tolerance: { abs: 0.7 } },
    { id: "ar23", label: "Apparel return rate FY2023", value: pct(F.c23.Apparel.returnRate!), kind: "percent", tolerance: { abs: 0.4 } },
    { id: "ar24", label: "Apparel return rate FY2024", value: pct(F.c24.Apparel.returnRate!), kind: "percent", tolerance: { abs: 0.4 } },
    { id: "agp", label: "Apparel gross profit change", value: m(F.apparelGpChange), kind: "eur", tolerance: { abs: 0.4 } },
    { id: "opex", label: "Opex increase", value: m(F.opexChange), kind: "eur", tolerance: { abs: 0.4 } },
    { id: "logi", label: "Logistics cost increase", value: m(F.logisticsChange), kind: "eur", tolerance: { abs: 0.3 } },
  ],
  recommendationThemes: [
    { id: "reprice", title: "Replace always-on electronics discounting with targeted, margin-gated promotions", concepts: [["techdeal", "promot", "discount", "pric", "markdown"], ["electronic", "tech"]], weight: 0.3 },
    { id: "supplier", title: "Renegotiate electronics supplier terms / sourcing", concepts: [["supplier", "vendor", "sourcing", "procure", "renegotiat", "purchas", "rebate"], ["electronic", "cost", "terms", "price"]], weight: 0.15 },
    { id: "returns", title: "Fix the returns policy (fees, thresholds, fit tools)", concepts: [["return"], ["fee", "charge", "policy", "threshold", "restrict", "minimum", "size", "fit", "paid"]], weight: 0.25 },
    { id: "mix", title: "Steer growth and marketing to higher-margin categories", concepts: [["mix", "high-margin", "higher margin", "higher-margin", "beauty", "home", "margin-rich"], ["promot", "market", "growth", "shift", "focus", "prioriti", "invest"]], weight: 0.15 },
    { id: "logistics", title: "Recover home-delivery and returns-handling costs", concepts: [["deliver", "logistic", "shipping", "fulfil", "handling"], ["fee", "charge", "threshold", "minimum", "cost", "reduc"]], weight: 0.1 },
    { id: "governance", title: "Manage on category margin, not revenue (KPIs, guardrails)", concepts: [["kpi", "guardrail", "track", "monitor", "dashboard", "governance", "target", "incentive"], ["margin", "profit", "contribution"]], weight: 0.05 },
  ],
  antiPatterns: [
    { id: "cut_staff", description: "Leading with store-staff cuts or closures: staff costs grew in line with inflation and do not explain the profit gap.", concepts: [["close", "cut", "reduc", "lay off", "layoff", "redundan"], ["store staff", "stores", "headcount", "staff"]] },
    { id: "exit_elec", description: "Exiting electronics entirely: the category still generated positive gross profit and drives traffic; the problem is pricing, not presence.", concepts: [["exit", "discontinu", "stop selling", "drop", "abandon"], ["electronic"]] },
  ],
  alternativeInterpretations: [
    "Some of the electronics volume gain may be traffic that benefits other categories; a halo-effect argument is reasonable but should be quantified before using it to justify the discounts.",
    "Free returns may lift apparel conversion online; a defensible view keeps free returns for loyalty members or above an order threshold rather than abolishing them.",
  ],
  commonMistakes: [
    "Concluding the business is healthy because revenue grew.",
    "Comparing gross profit without separating price, cost and mix effects.",
    "Blaming the East region: its dip in May–June 2024 is a temporary refurbishment effect.",
    "Treating seasonal apparel clearance as a root cause — it ran in both years.",
    "Mixing up percentage change and percentage-point change for margins.",
  ],
  modelRecommendation: {
    executiveSummary: `Nordhaven's FY2024 growth destroyed value: net sales rose ${fmtPct(F.netSalesGrowth)} but operating profit fell ${fmtEurM(Math.abs(F.opChange))} to ${fmtEurM(F.p24.operatingProfit)} (margin ${fmtPct(F.p23.operatingMargin)} → ${fmtPct(F.p24.operatingMargin)}). Roughly two-thirds of the decline comes from electronics and apparel returns, not from overheads. We recommend ending always-on TechDeals pricing, renegotiating electronics supply terms and introducing a paid-returns threshold, which together can restore roughly €10m of operating profit within 12 months.`,
    diagnosis: `Gross profit fell ${fmtEurM(Math.abs(F.gpChange))} on higher sales (flow-through ${fmtPct(F.flowThrough)}), and opex rose ${fmtEurM(F.opexChange)}. The profit problem is primarily a gross-margin problem concentrated in two decisions taken for growth.`,
    rootCauses: `1) Electronics: price −${fmtPct(Math.abs(F.elecPriceChange))}, unit cost +${fmtPct(F.elecCostChange)}, margin ${fmtPct(F.c23.Electronics.grossMargin)} → ${fmtPct(F.c24.Electronics.grossMargin)}.\n2) Mix: electronics share ${fmtPct(F.c23.Electronics.share)} → ${fmtPct(F.c24.Electronics.share)} dilutes group margin.\n3) Apparel returns ${fmtPct(F.c23.Apparel.returnRate)} → ${fmtPct(F.c24.Apparel.returnRate)} after free returns.\n4) Secondary: logistics +${fmtEurM(F.logisticsChange)} and marketing +${fmtEurM(F.marketingChange)}.`,
    quantitativeEvidence: `Electronics gross profit ${fmtEurM(F.elecGpChange)} despite +${fmtPct(F.elecSalesGrowth)} sales; apparel gross profit ${fmtEurM(F.apparelGpChange)}; group gross margin ${fmtPct(F.p23.grossMargin)} → ${fmtPct(F.p24.grossMargin)}. Store staff +${fmtPct(F.staffGrowth)} only. The East dip (May–Jun 2024) is a refurbishment and reverses.`,
    recommendedActions: "1) Replace always-on TechDeals with targeted event promotions gated by a minimum category margin.\n2) Renegotiate electronics supplier terms (volume rebates now justified by +40% units).\n3) Introduce a returns fee below an order threshold, keep free returns for loyalty members; add size/fit guidance.\n4) Rebalance marketing toward Beauty and Home & Living.\n5) Charge for electronics home delivery below a threshold.",
    financialImpact: `Simulator (+4% electronics price, −3% electronics unit cost, apparel returns −4pp, 5% marketing/logistics savings): operating profit ${fmtEurM(F.scenario.baseline.operatingProfit)} → ${fmtEurM(F.scenario.scenario.operatingProfit)} (margin ${fmtPct(F.scenario.baseline.operatingMargin)} → ${fmtPct(F.scenario.scenario.operatingMargin)}) with net sales broadly unchanged.`,
    implementationPriorities: "Quick wins (0–3 months): margin gate on promotions, returns threshold. Medium term (3–9 months): supplier renegotiation, marketing reallocation. Ongoing: weekly category-margin dashboard.",
    risks: "Electronics volume may fall more than the −1.5 elasticity implies; competitor reaction; customer backlash on returns — mitigate with loyalty exemption and A/B testing by region.",
  },
  hintTopics: [
    { id: "bridge", triggers: ["profit", "bridge", "where", "start", "begin", "structure"], question: "Revenue grew. Where between net sales and operating profit did the money disappear — gross profit or operating expenses?", hints: ["Compare the change in gross profit with the change in operating expenses between FY2023 and FY2024.", "Gross profit fell even though sales rose, so most of the problem sits above the opex line. Which categories drive the gross-profit change?", "Rank categories by their change in gross profit FY2024 vs FY2023 — two categories stand out."], method: "A profit bridge walks from last year's operating profit to this year's in additive steps: volume, price, mix, unit cost, returns, then each opex line. Each step must be quantified so the bridge reconciles exactly." },
    { id: "electronics", triggers: ["electronic", "tech", "price", "discount", "promotion"], question: "Which category grew fastest — and what happened to its margin while it grew?", hints: ["Plot average selling price and gross margin for each category by month. Does anything change in early 2024?", "Look at the promotions calendar for programmes that started in 2024.", "Electronics price fell while unit cost rose — compute the category margin in both years."], method: "Gross margin per unit = price − unit cost. A price cut of x% on a thin-margin product reduces unit margin by far more than x%: with a 22% margin, an 8% price cut alone removes over a third of the unit margin." },
    { id: "mix", triggers: ["mix", "share", "category", "dilut"], question: "If every category kept its FY2023 margin, would the group margin still have fallen?", hints: ["Compute each category's share of net sales in both years.", "Weight FY2023 category margins by FY2024 shares to isolate the mix effect."], method: "Mix effect = Σ (share₂₀₂₄ − share₂₀₂₃) × margin₂₀₂₃. It isolates how much margin changed purely because the business sold a different blend of products." },
    { id: "returns", triggers: ["return", "refund", "apparel", "fashion"], question: "Are customers keeping what they buy at the same rate as last year?", hints: ["Look at the returns table by category and month.", "Check when the apparel return rate changed and compare with the promotions calendar."], method: "Returns hit profit three ways: lost net sales, write-off of unsaleable items, and handling costs in logistics. Quantify each separately." },
    { id: "opex", triggers: ["opex", "cost", "expense", "staff", "rent", "logistic"], question: "Which expense lines grew faster than sales, and do their drivers relate to the commercial decisions of 2024?", hints: ["Compute growth by opex line and compare with net sales growth.", "Logistics is partly variable: what drives it?"], method: "Classify opex as fixed (rent), semi-fixed (staff) and variable (logistics). Variable lines should be explained by activity drivers such as returned units or deliveries." },
    { id: "region", triggers: ["region", "east", "north", "south", "west"], question: "Is the regional pattern structural, or explained by a one-off event?", hints: ["Look at the East region month by month and check the store reference table."], method: "Before attributing a variance to a segment, check whether it is persistent and whether a known event explains it." },
  ],
};
