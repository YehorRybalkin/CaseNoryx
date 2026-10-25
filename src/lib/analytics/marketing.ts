import { type Maybe, isNum, safeDivide } from "./numbers";

export const conversionRate = (orders: Maybe, sessions: Maybe) => safeDivide(orders, sessions);
export const averageOrderValue = (revenue: Maybe, orders: Maybe) => safeDivide(revenue, orders);
/** Return on ad spend = attributed revenue / ad spend. Revenue-based, NOT a profit measure. */
export const roas = (revenue: Maybe, spend: Maybe) => safeDivide(revenue, spend);
export const marketingCac = (spend: Maybe, newCustomers: Maybe) => safeDivide(spend, newCustomers);
export const costPerOrder = (spend: Maybe, orders: Maybe) => safeDivide(spend, orders);

/**
 * Marketing contribution profit = revenue × product gross margin
 *   − variable fulfilment costs − payment fees − marketing spend.
 */
export function marketingContribution(p: {
  revenue: Maybe;
  grossMargin: Maybe;
  orders: Maybe;
  fulfilmentPerOrder?: Maybe;
  paymentFeeRate?: Maybe;
  spend: Maybe;
}): number | null {
  if (!isNum(p.revenue) || !isNum(p.grossMargin) || !isNum(p.spend)) return null;
  const fulfil = isNum(p.fulfilmentPerOrder) && isNum(p.orders) ? p.fulfilmentPerOrder * p.orders : 0;
  const fees = isNum(p.paymentFeeRate) ? p.paymentFeeRate * p.revenue : 0;
  return p.revenue * p.grossMargin - fulfil - fees - p.spend;
}

/**
 * ROAS at which marketing contribution is exactly zero, given the unit economics.
 * breakEvenRoas = 1 / (margin − feeRate − fulfilment/AOV).
 */
export function breakEvenRoas(p: {
  grossMargin: Maybe;
  paymentFeeRate?: Maybe;
  fulfilmentPerOrder?: Maybe;
  aov?: Maybe;
}): number | null {
  if (!isNum(p.grossMargin)) return null;
  const fulfilShare = isNum(p.fulfilmentPerOrder) && isNum(p.aov) && p.aov > 0 ? p.fulfilmentPerOrder / p.aov : 0;
  const net = p.grossMargin - (p.paymentFeeRate ?? 0) - fulfilShare;
  if (net <= 0) return null;
  return 1 / net;
}

/** Contribution generated per euro of marketing spend. */
export const marketingEfficiency = (contributionProfit: Maybe, spend: Maybe) => safeDivide(contributionProfit, spend);
