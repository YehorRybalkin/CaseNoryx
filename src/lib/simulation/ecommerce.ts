import { safeDivide } from "@/lib/analytics";
import { CHANNEL_PARAMS, CHANNELS, FULFILMENT_PER_ORDER, PAYMENT_FEE_RATE, type Channel } from "@/lib/cases/ecommerce/data";
import { channelSummary } from "@/lib/cases/ecommerce/metrics";
import type { ScenarioResult } from "@/lib/cases/types";

export interface EcomInputs {
  socialBudget: number;
  displayBudget: number;
  nonBrandBudget: number;
  brandBudget: number;
  affiliateBudget: number;
  cvrImprovement: number;
}

const LEVER_CHANNEL: Record<keyof Omit<EcomInputs, "cvrImprovement">, Channel> = {
  socialBudget: "Paid social",
  displayBudget: "Display & programmatic",
  nonBrandBudget: "Paid search – non-brand",
  brandBudget: "Paid search – brand",
  affiliateBudget: "Affiliates",
};

const BASE = Object.fromEntries(CHANNELS.map((c) => [c, channelSummary({ year: 2024, channel: c })])) as Record<Channel, ReturnType<typeof channelSummary>>;

function run(x: EcomInputs) {
  const cvr = 1 + x.cvrImprovement / 100;
  let spend = 0, revenue = 0, grossProfit = 0, orders = 0, newCustomers = 0, trueRevenueDelta = 0, trueMarginDelta = 0;
  for (const c of CHANNELS) {
    const b = BASE[c];
    const lever = (Object.keys(LEVER_CHANNEL) as (keyof typeof LEVER_CHANNEL)[]).find((k) => LEVER_CHANNEL[k] === c);
    const change = lever ? x[lever] / 100 : 0;
    const s = b.spend * (1 + change);
    const respond = b.spend > 0 ? (s / b.spend) ** CHANNEL_PARAMS[c].beta : 1;
    const r = b.revenue * respond * cvr;
    const o = b.orders * respond * cvr;
    const gm = b.grossMargin ?? 0;
    spend += s;
    revenue += r;
    orders += o;
    grossProfit += r * gm;
    newCustomers += b.newCustomers * respond * cvr;
    // Only the incremental share of a change in attributed revenue is real for the business
    const inc = CHANNEL_PARAMS[c].incrementality;
    const dr = (r - b.revenue) * (c === "Organic & direct" ? 1 : inc);
    const dOrders = (o - b.orders) * (c === "Organic & direct" ? 1 : inc);
    trueRevenueDelta += dr;
    trueMarginDelta += dr * (gm - PAYMENT_FEE_RATE) - dOrders * FULFILMENT_PER_ORDER;
  }
  const paidSpend = spend;
  const paidRevenue = revenue - BASE["Organic & direct"].revenue * cvr;
  const attributedContribution = grossProfit - revenue * PAYMENT_FEE_RATE - orders * FULFILMENT_PER_ORDER - spend;
  return { spend, paidSpend, paidRevenue, revenue, orders, newCustomers, attributedContribution, trueRevenueDelta, trueMarginDelta };
}

export function simulateEcommerce(x: EcomInputs): ScenarioResult {
  const zero: EcomInputs = { socialBudget: 0, displayBudget: 0, nonBrandBudget: 0, brandBudget: 0, affiliateBudget: 0, cvrImprovement: 0 };
  const b = run(zero);
  const s = run(x);
  const shape = (r: ReturnType<typeof run>) => ({
    spend: r.spend,
    revenue: r.revenue,
    paidRoas: safeDivide(r.paidRevenue, r.paidSpend),
    newCustomers: r.newCustomers,
    cac: safeDivide(r.spend, r.newCustomers),
    attributedContribution: r.attributedContribution,
    // Incrementality-adjusted: base contribution + incremental margin change − spend change
    incrementalContribution: b.attributedContribution + r.trueMarginDelta - (r.spend - b.spend),
  });
  return {
    baseline: shape(b),
    scenario: shape(s),
    notes: [
      "Baseline = 2024 actuals by channel.",
      "Attributed revenue responds to budget with diminishing returns: revenue ∝ spend^β (β: brand 0.30, non-brand 0.78, social 0.62, display 0.55, affiliates 0.72).",
      "Conversion-rate improvement scales orders and revenue in every channel without extra spend.",
      "Incrementality-adjusted contribution counts only the incremental share (holdout tests) of any change in attributed revenue.",
      `Contribution = revenue × channel gross margin − ${PAYMENT_FEE_RATE * 100}% payment fees − €${FULFILMENT_PER_ORDER} fulfilment per order − marketing spend.`,
    ],
  };
}
