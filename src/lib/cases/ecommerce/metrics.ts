import { averageOrderValue, breakEvenRoas, conversionRate, marketingCac, marketingContribution, roas, safeDivide, sumMoney } from "@/lib/analytics";
import { CHANNEL_PARAMS, FULFILMENT_PER_ORDER, PAYMENT_FEE_RATE, ecomData, type Channel } from "./data";

export function channelSummary(f: { year?: number; from?: string; to?: string; channel?: Channel }) {
  const rows = ecomData.channels.filter(
    (r) => (!f.year || r.year === f.year) && (!f.from || r.month >= f.from) && (!f.to || r.month <= f.to) && (!f.channel || r.channel === f.channel),
  );
  const spend = sumMoney(rows.map((r) => r.spend));
  const revenue = sumMoney(rows.map((r) => r.revenue));
  const orders = rows.reduce((a, r) => a + r.orders, 0);
  const sessions = rows.reduce((a, r) => a + r.sessions, 0);
  const newCustomers = rows.reduce((a, r) => a + r.new_customers, 0);
  const grossProfit = rows.reduce((a, r) => a + r.revenue * r.gross_margin, 0);
  const gm = safeDivide(grossProfit, revenue);
  const contribution = marketingContribution({ revenue, grossMargin: gm, orders, fulfilmentPerOrder: FULFILMENT_PER_ORDER, paymentFeeRate: PAYMENT_FEE_RATE, spend });
  const aov = averageOrderValue(revenue, orders);
  return {
    spend, revenue, orders, sessions, newCustomers, grossMargin: gm,
    roas: roas(revenue, spend),
    cvr: conversionRate(orders, sessions),
    aov,
    cac: marketingCac(spend, newCustomers),
    contribution,
    breakEvenRoas: breakEvenRoas({ grossMargin: gm, paymentFeeRate: PAYMENT_FEE_RATE, fulfilmentPerOrder: FULFILMENT_PER_ORDER, aov }),
    incrementalShare: f.channel ? CHANNEL_PARAMS[f.channel].incrementality : null,
  };
}

/** Contribution counting only incremental revenue (from holdout tests); spend counted in full. */
export function incrementalContribution(s: ReturnType<typeof channelSummary>, incrementalShare: number) {
  if (s.grossMargin === null || s.aov === null) return null;
  const incRevenue = s.revenue * incrementalShare;
  return incRevenue * (s.grossMargin - PAYMENT_FEE_RATE) - (incRevenue / s.aov) * FULFILMENT_PER_ORDER - s.spend;
}
