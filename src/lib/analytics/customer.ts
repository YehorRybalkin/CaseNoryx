import { type Maybe, isNum, safeDivide } from "./numbers";

/** Period churn rate = customers lost / customers at start of period. */
export function churnRate(churned: Maybe, startingCustomers: Maybe): number | null {
  return safeDivide(churned, startingCustomers);
}

export function retentionRate(churned: Maybe, startingCustomers: Maybe): number | null {
  const c = churnRate(churned, startingCustomers);
  return c === null ? null : 1 - c;
}

/** Ending MRR = starting + new + expansion − contraction − churned. */
export function endingMrr(m: {
  starting: Maybe;
  newMrr: Maybe;
  expansion: Maybe;
  contraction: Maybe;
  churned: Maybe;
}): number | null {
  if (!isNum(m.starting)) return null;
  return m.starting + (m.newMrr ?? 0) + (m.expansion ?? 0) - (m.contraction ?? 0) - (m.churned ?? 0);
}

/**
 * Net revenue retention for a period: revenue retained from the starting base
 * (excludes new customers). NRR = (start + expansion − contraction − churn) / start.
 */
export function netRevenueRetention(m: {
  starting: Maybe;
  expansion: Maybe;
  contraction: Maybe;
  churned: Maybe;
}): number | null {
  if (!isNum(m.starting) || m.starting === 0) return null;
  return (m.starting + (m.expansion ?? 0) - (m.contraction ?? 0) - (m.churned ?? 0)) / m.starting;
}

export function grossRevenueRetention(m: { starting: Maybe; contraction: Maybe; churned: Maybe }): number | null {
  if (!isNum(m.starting) || m.starting === 0) return null;
  return (m.starting - (m.contraction ?? 0) - (m.churned ?? 0)) / m.starting;
}

/** Customer acquisition cost = acquisition spend / new customers. */
export function cac(acquisitionSpend: Maybe, newCustomers: Maybe): number | null {
  return safeDivide(acquisitionSpend, newCustomers);
}

/** Average revenue per account. */
export function arpa(mrr: Maybe, customers: Maybe): number | null {
  return safeDivide(mrr, customers);
}

export interface LtvAssumptions {
  /** Monthly revenue per account. */
  arpaMonthly: Maybe;
  /** Gross margin on subscription revenue, fraction. */
  grossMargin: Maybe;
  /** Monthly logo churn rate, fraction. */
  monthlyChurn: Maybe;
  /** Cap on expected lifetime in months (avoids infinite LTV at near-zero churn). */
  maxLifetimeMonths?: number;
}

/**
 * Customer lifetime value (gross-margin basis, undiscounted):
 *   LTV = ARPA × gross margin × expected lifetime, lifetime = min(1 / churn, cap).
 */
export function ltv(a: LtvAssumptions): number | null {
  if (!isNum(a.arpaMonthly) || !isNum(a.grossMargin) || !isNum(a.monthlyChurn)) return null;
  if (a.monthlyChurn < 0) return null;
  const cap = a.maxLifetimeMonths ?? 60;
  const lifetime = a.monthlyChurn === 0 ? cap : Math.min(1 / a.monthlyChurn, cap);
  return a.arpaMonthly * a.grossMargin * lifetime;
}

export function ltvToCac(ltvValue: Maybe, cacValue: Maybe): number | null {
  return safeDivide(ltvValue, cacValue);
}

/** Months of gross-margin needed to recover CAC. */
export function cacPaybackMonths(cacValue: Maybe, arpaMonthly: Maybe, grossMargin: Maybe): number | null {
  if (!isNum(arpaMonthly) || !isNum(grossMargin)) return null;
  return safeDivide(cacValue, arpaMonthly * grossMargin);
}
