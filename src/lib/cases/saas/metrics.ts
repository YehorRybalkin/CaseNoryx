/** SaaS aggregations shared by analytics, simulator and grading. */
import { cac, churnRate, ltv, ltvToCac, netRevenueRetention, safeDivide, sumMoney } from "@/lib/analytics";
import { saasData, type SaasSegment } from "./data";

type Filter = { segment?: SaasSegment | "All"; from?: string; to?: string };
const inRange = (m: string, f: Filter) => (!f.from || m >= f.from) && (!f.to || m <= f.to);

export function segmentRows(f: Filter) {
  return saasData.segments.filter((r) => inRange(r.month, f) && (!f.segment || f.segment === "All" || r.segment === f.segment));
}

/** Pooled monthly logo churn: Σ churned / Σ starting customers over the period. */
export function avgMonthlyChurn(f: Filter): number | null {
  const rows = segmentRows(f);
  return churnRate(rows.reduce((a, r) => a + r.churned_customers, 0), rows.reduce((a, r) => a + r.starting_customers, 0));
}

/** Monthly time series aggregated across the selected segment(s). */
export function monthlySeries(f: Filter) {
  const rows = segmentRows(f);
  const months = [...new Set(rows.map((r) => r.month))].sort();
  return months.map((month) => {
    const r = rows.filter((x) => x.month === month);
    const s = (k: keyof (typeof r)[number]) => r.reduce((a, x) => a + (x[k] as number), 0);
    const startingMrr = s("starting_mrr");
    return {
      month,
      customers: s("ending_customers"),
      newCustomers: s("new_customers"),
      churned: s("churned_customers"),
      churnRate: churnRate(s("churned_customers"), s("starting_customers")),
      mrr: s("ending_mrr"),
      newMrr: s("new_mrr"),
      expansion: s("expansion_mrr"),
      contraction: s("contraction_mrr"),
      churnedMrr: s("churned_mrr"),
      nrr: netRevenueRetention({ starting: startingMrr, expansion: s("expansion_mrr"), contraction: s("contraction_mrr"), churned: s("churned_mrr") }),
    };
  });
}

/** Annualised NRR = product of monthly NRR over the period (12 months for a year). */
export function compoundedNrr(f: Filter): number | null {
  const series = monthlySeries(f);
  if (series.length === 0 || series.some((m) => m.nrr === null)) return null;
  return series.reduce((a, m) => a * (m.nrr as number), 1);
}

export function acquisitionCac(f: Filter & { channel?: string }): number | null {
  const rows = saasData.acquisition.filter(
    (r) => inRange(r.month, f) && (!f.segment || f.segment === "All" || r.segment === f.segment) && (!f.channel || r.channel === f.channel),
  );
  return cac(sumMoney(rows.map((r) => r.acquisition_spend)), rows.reduce((a, r) => a + r.new_customers, 0));
}

export function acquisitionSpend(f: Filter): number {
  return sumMoney(saasData.acquisition.filter((r) => inRange(r.month, f) && (!f.segment || f.segment === "All" || r.segment === f.segment)).map((r) => r.acquisition_spend));
}

/** Subscription revenue for a month is taken as that month's ending MRR. */
export function revenue(f: Filter): number {
  return sumMoney(segmentRows(f).map((r) => r.ending_mrr));
}

export function serviceCosts(f: { from?: string; to?: string }): number {
  return sumMoney(saasData.serviceCosts.filter((r) => inRange(r.month, f)).map((r) => r.amount));
}

/** Blended subscription gross margin = 1 − service costs / subscription revenue. */
export function grossMargin(f: { from?: string; to?: string }): number | null {
  const rev = revenue({ ...f, segment: "All" });
  return safeDivide(rev - serviceCosts(f), rev);
}

/** Average revenue per account = Σ ending MRR / Σ ending customers over the period. */
export function arpa(f: Filter): number | null {
  const rows = segmentRows(f);
  return safeDivide(sumMoney(rows.map((r) => r.ending_mrr)), rows.reduce((a, r) => a + r.ending_customers, 0));
}

/** LTV with the case's declared assumptions (blended GM, pooled churn, 60-month cap). */
export function segmentLtv(segment: SaasSegment, from: string, to: string) {
  const value = ltv({ arpaMonthly: arpa({ segment, from, to }), grossMargin: grossMargin({ from, to }), monthlyChurn: avgMonthlyChurn({ segment, from, to }), maxLifetimeMonths: 60 });
  const c = acquisitionCac({ segment, from, to });
  return { ltv: value, cac: c, ratio: ltvToCac(value, c) };
}

/** Retention curve (average across cohorts) for a segment/channel up to `maxK` months. */
export function retentionCurve(f: { segment?: string; channel?: string; fromCohort?: string; toCohort?: string }, maxK = 12) {
  const rows = saasData.cohorts.filter(
    (c) =>
      (!f.segment || c.segment === f.segment) &&
      (!f.channel || c.acquisition_channel === f.channel) &&
      (!f.fromCohort || c.cohort_month >= f.fromCohort) &&
      (!f.toCohort || c.cohort_month <= f.toCohort),
  );
  const out: { k: number; retention: number | null; cohorts: number }[] = [];
  for (let k = 0; k <= maxK; k++) {
    const at = rows.filter((r) => r.months_since_start === k);
    // only cohorts that have reached age k; pool active / size
    out.push({ k, retention: safeDivide(at.reduce((a, r) => a + r.active_customers, 0), at.reduce((a, r) => a + r.cohort_size, 0)), cohorts: at.length });
  }
  return out;
}
