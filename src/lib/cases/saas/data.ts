/**
 * Case 2 — Lumora Cloud (synthetic B2B SaaS).
 * Customers are simulated cohort by cohort (Jul 2023 – Dec 2024), so segment
 * totals, MRR movements and cohort retention reconcile exactly.
 */
import { round } from "@/lib/analytics/numbers";
import { createRng, monthIndex, monthRange, yearOf } from "../random";

export const SAAS_SEED = 7_310_2024;
export const SAAS_MONTHS = monthRange(2023, 7, 18);
export const SAAS_SEGMENTS = ["SMB", "Mid-Market", "Enterprise"] as const;
export type SaasSegment = (typeof SAAS_SEGMENTS)[number];

export interface SaasSegmentRow {
  month: string;
  segment: SaasSegment;
  starting_customers: number;
  new_customers: number;
  churned_customers: number;
  ending_customers: number;
  starting_mrr: number;
  new_mrr: number;
  expansion_mrr: number;
  contraction_mrr: number;
  churned_mrr: number;
  ending_mrr: number;
}
export interface SaasAcquisitionRow {
  month: string;
  segment: SaasSegment;
  channel: string;
  new_customers: number;
  acquisition_spend: number;
}
export interface SaasCohortRow {
  cohort_month: string;
  segment: SaasSegment;
  acquisition_channel: string;
  months_since_start: number;
  cohort_size: number;
  active_customers: number;
  retention: number;
}
export interface SaasServiceCostRow {
  month: string;
  cost_line: string;
  amount: number;
}
export interface SaasSupportRow {
  month: string;
  segment: SaasSegment;
  support_tickets: number;
  tickets_per_customer: number;
  first_response_hours: number;
  csat: number;
  platform_uptime: number;
}

const PROMO_START = "2024-01";
const isPromoPeriod = (ym: string) => ym >= PROMO_START;

const SMB_PRICE = 95;
const SMB_PROMO_PRICE = 47.5; // 50% off for the first 3 months
const MID_PRICE = 640;
const ENT_PRICE = 4100;

/** Monthly logo-churn hazard by segment, tenure (months since acquisition) and cohort type. */
function hazard(seg: SaasSegment, tenure: number | "legacy", promo: boolean, ym: string): number {
  if (seg === "SMB") {
    if (tenure === "legacy") return 0.026;
    if (promo) return tenure === 3 ? 0.24 : tenure < 3 ? 0.065 : 0.058;
    return tenure <= 2 ? 0.036 : 0.03;
  }
  if (seg === "Mid-Market") {
    const priceShock = ym >= "2024-04" && ym <= "2024-06" ? 0.006 : 0;
    return (tenure === "legacy" ? 0.011 : 0.013) + priceShock;
  }
  return 0.005;
}

interface Cohort {
  month: string;
  seg: SaasSegment;
  promo: boolean;
  channel: string;
  size: number;
  active: number;
  mrr: number;
  legacy: boolean;
}

export function generateSaasData() {
  const rng = createRng(SAAS_SEED);
  const segRows: SaasSegmentRow[] = [];
  const acq: SaasAcquisitionRow[] = [];
  const cohortRows: SaasCohortRow[] = [];
  const service: SaasServiceCostRow[] = [];
  const support: SaasSupportRow[] = [];
  const cohorts: Cohort[] = [
    { month: "legacy", seg: "SMB", promo: false, channel: "Legacy", size: 2400, active: 2400, mrr: 2400 * 92, legacy: true },
    { month: "legacy", seg: "Mid-Market", promo: false, channel: "Legacy", size: 520, active: 520, mrr: 520 * 610, legacy: true },
    { month: "legacy", seg: "Enterprise", promo: false, channel: "Legacy", size: 85, active: 85, mrr: 85 * 3950, legacy: true },
  ];
  const stochRound = (x: number) => Math.floor(x + rng.next());
  const tenureOf = (c: Cohort, ym: string) => {
    const [y0, m0] = c.month.split("-").map(Number);
    const [y1, m1] = ym.split("-").map(Number);
    return (y1 - y0) * 12 + (m1 - m0);
  };

  SAAS_MONTHS.forEach((ym, t) => {
    const m = monthIndex(ym);
    const seasonal = m === 8 ? 0.85 : m === 12 ? 0.8 : m === 1 ? 1.1 : 1;
    for (const seg of SAAS_SEGMENTS) {
      const segCohorts = cohorts.filter((c) => c.seg === seg);
      const startingCustomers = segCohorts.reduce((a, c) => a + c.active, 0);
      const startingMrr = segCohorts.reduce((a, c) => a + c.mrr, 0);
      let churned = 0, churnedMrr = 0, expansion = 0, contraction = 0;

      for (const c of segCohorts) {
        if (c.active === 0) continue;
        const tenure = c.legacy ? "legacy" : tenureOf(c, ym);
        let lost = Math.min(c.active, stochRound(c.active * hazard(seg, tenure, c.promo, ym)));
        // One-off: a large enterprise logo is acquired by a competitor's parent (Sep 2024)
        if (seg === "Enterprise" && ym === "2024-09" && c.legacy) lost += 1;
        const perCust = c.mrr / c.active;
        const lostMrr = seg === "Enterprise" && ym === "2024-09" && c.legacy ? (lost - 1) * perCust + 38_000 : lost * perCust;
        c.active -= lost;
        c.mrr = Math.max(0, c.mrr - lostMrr);
        churned += lost;
        churnedMrr += lostMrr;

        // Contraction (downgrades / seat reductions)
        let cRate = seg === "SMB" ? 0.003 : seg === "Mid-Market" ? 0.004 : 0.003;
        if (seg === "Mid-Market" && ym >= "2024-04" && ym <= "2024-06") cRate += 0.018; // downgrades after Growth-plan price rise
        const con = c.mrr * cRate;
        c.mrr -= con;
        contraction += con;

        // Expansion (upsell, seat growth, list-price changes, expiry of intro discounts)
        let eRate = seg === "SMB" ? 0.004 : seg === "Mid-Market" ? 0.013 : 0.021;
        if (seg === "Mid-Market" && ym === "2024-04") eRate += 0.08; // Growth plan +15% list price for ~55% of base
        let exp = c.mrr * eRate;
        if (c.promo && tenure === 3) exp += c.active * (SMB_PRICE - SMB_PROMO_PRICE);
        c.mrr += exp;
        expansion += exp;
      }

      // New customers by channel
      const channels: { channel: string; n: number; cac: number; promo: boolean }[] = [];
      if (seg === "SMB") {
        const promoRamp = isPromoPeriod(ym) ? Math.min(1, 0.55 + 0.05 * (t - 6)) : 0;
        channels.push(
          { channel: "Paid social", n: Math.round((isPromoPeriod(ym) ? 255 * promoRamp + 30 : 34) * seasonal * rng.noise(0.08)), cac: isPromoPeriod(ym) ? 820 + 22 * (t - 6) : 690, promo: isPromoPeriod(ym) },
          { channel: "Paid search", n: Math.round(78 * seasonal * rng.noise(0.08)), cac: 560, promo: false },
          { channel: "Organic & referral", n: Math.round(52 * seasonal * rng.noise(0.1)), cac: 95, promo: false },
        );
      } else if (seg === "Mid-Market") {
        channels.push(
          { channel: "Paid search", n: Math.round(9 * seasonal * rng.noise(0.15)), cac: 3200, promo: false },
          { channel: "Outbound sales", n: Math.round(8 * seasonal * rng.noise(0.15)), cac: 6400, promo: false },
          { channel: "Partners", n: Math.round(6 * seasonal * rng.noise(0.2)), cac: 4100, promo: false },
        );
      } else {
        channels.push(
          { channel: "Outbound sales", n: Math.round(2 * rng.noise(0.3)) + (m % 3 === 0 ? 1 : 0), cac: 38_000, promo: false },
          { channel: "Partners", n: m % 2 === 0 ? 1 : 0, cac: 29_500, promo: false },
        );
      }
      let newCustomers = 0, newMrr = 0;
      for (const ch of channels) {
        const spend = round(ch.n * ch.cac * rng.noise(0.05) + (seg === "Enterprise" ? 6_000 : 0), 2);
        acq.push({ month: ym, segment: seg, channel: ch.channel, new_customers: ch.n, acquisition_spend: spend });
        if (ch.n === 0) continue;
        // Paid social SMB acquisitions in 2024 came through the "50% off for 3 months" campaign
        const promoN = ch.promo ? Math.round(ch.n * 0.88) : 0;
        const regularN = ch.n - promoN;
        const price = seg === "SMB" ? SMB_PRICE : seg === "Mid-Market" ? MID_PRICE * (ym >= "2024-04" ? 1.08 : 1) : ENT_PRICE;
        if (promoN > 0) {
          cohorts.push({ month: ym, seg, promo: true, channel: ch.channel, size: promoN, active: promoN, mrr: promoN * SMB_PROMO_PRICE, legacy: false });
          newMrr += promoN * SMB_PROMO_PRICE;
        }
        if (regularN > 0) {
          const mrr = regularN * price * rng.noise(0.04);
          cohorts.push({ month: ym, seg, promo: false, channel: ch.channel, size: regularN, active: regularN, mrr, legacy: false });
          newMrr += mrr;
        }
        newCustomers += ch.n;
      }
      const endingCustomers = startingCustomers - churned + newCustomers;
      const endingMrr = startingMrr + newMrr + expansion - contraction - churnedMrr;
      segRows.push({
        month: ym,
        segment: seg,
        starting_customers: startingCustomers,
        new_customers: newCustomers,
        churned_customers: churned,
        ending_customers: endingCustomers,
        starting_mrr: round(startingMrr, 2),
        new_mrr: round(newMrr, 2),
        expansion_mrr: round(expansion, 2),
        contraction_mrr: round(contraction, 2),
        churned_mrr: round(churnedMrr, 2),
        ending_mrr: round(startingMrr, 2) + round(newMrr, 2) + round(expansion, 2) - round(contraction, 2) - round(churnedMrr, 2),
      });
      // keep reported starting MRR consistent with previous ending MRR
      const last = segRows[segRows.length - 1];
      last.ending_mrr = round(last.ending_mrr, 2);
      void endingMrr;
    }

    // Snapshot cohort retention at the end of the month
    for (const c of cohorts) {
      if (c.legacy) continue;
      const k = tenureOf(c, ym);
      if (k < 0) continue;
      const existing = cohortRows.find((r) => r.cohort_month === c.month && r.segment === c.seg && r.acquisition_channel === c.channel && r.months_since_start === k);
      if (existing) {
        existing.cohort_size += c.size;
        existing.active_customers += c.active;
      } else {
        cohortRows.push({ cohort_month: c.month, segment: c.seg, acquisition_channel: c.channel, months_since_start: k, cohort_size: c.size, active_customers: c.active, retention: 0 });
      }
    }

    // Support operations
    const active = (seg: SaasSegment, promoOnly?: boolean) =>
      cohorts.filter((c) => c.seg === seg && (promoOnly === undefined || c.promo === promoOnly)).reduce((a, c) => a + c.active, 0);
    const newThisMonth = (seg: SaasSegment) => segRows.filter((r) => r.month === ym && r.segment === seg)[0].new_customers;
    let totalTickets = 0;
    for (const seg of SAAS_SEGMENTS) {
      const base = seg === "SMB" ? active(seg, false) * 0.85 + active(seg, true) * 2.3 + newThisMonth(seg) * 2.0 : seg === "Mid-Market" ? active(seg) * 1.6 : active(seg) * 4.2;
      const tickets = Math.round(base * rng.noise(0.04));
      totalTickets += tickets;
      const customers = active(seg);
      support.push({
        month: ym,
        segment: seg,
        support_tickets: tickets,
        tickets_per_customer: round(tickets / customers, 2),
        first_response_hours: 0, // filled below
        csat: 0,
        platform_uptime: round(0.9994 + rng.uniform(-0.0003, 0.0004), 4),
      });
    }
    const load = totalTickets / 6800; // capacity planned for ~6,200 tickets/month
    for (const r of support.filter((s) => s.month === ym)) {
      const segFactor = r.segment === "Enterprise" ? 0.35 : r.segment === "Mid-Market" ? 0.7 : 1;
      r.first_response_hours = round(Math.max(1, 6 * load ** 2.2 * segFactor * rng.noise(0.05)), 1);
      r.csat = round(Math.min(0.96, Math.max(0.6, 0.93 - 0.11 * Math.max(0, load - 0.9) * (r.segment === "SMB" ? 1.4 : 0.8))), 3);
    }

    // Service costs (cost of revenue)
    const mrrTotal = segRows.filter((r) => r.month === ym).reduce((a, r) => a + r.ending_mrr, 0);
    const smbMrr = segRows.filter((r) => r.month === ym && r.segment === "SMB")[0].ending_mrr;
    const newBy = (seg: SaasSegment) => newThisMonth(seg);
    const supportFte = Math.max(20, Math.ceil(totalTickets / 165));
    service.push(
      { month: ym, cost_line: "Hosting & infrastructure", amount: round(mrrTotal * 0.075 * rng.noise(0.02) + 28_000, 2) },
      { month: ym, cost_line: "Customer support", amount: round(supportFte * 5_800 + totalTickets * 2.1, 2) },
      { month: ym, cost_line: "Onboarding & customer success", amount: round(newBy("SMB") * (ym >= "2024-01" ? 145 : 60) + newBy("Mid-Market") * 950 + newBy("Enterprise") * 6_500 + 62_000, 2) },
      { month: ym, cost_line: "Payment processing", amount: round(smbMrr * 0.029 + (mrrTotal - smbMrr) * 0.004, 2) },
    );
    void yearOf;
  });

  for (const r of cohortRows) r.retention = r.cohort_size === 0 ? 0 : round(r.active_customers / r.cohort_size, 4);
  cohortRows.sort((a, b) => (a.cohort_month + a.segment + a.acquisition_channel).localeCompare(b.cohort_month + b.segment + b.acquisition_channel) || a.months_since_start - b.months_since_start);

  const plans = [
    { plan: "Starter", list_price_monthly: 49, typical_segment: "SMB", seats_included: 3, billing: "Monthly" },
    { plan: "Team", list_price_monthly: 129, typical_segment: "SMB", seats_included: 10, billing: "Monthly / annual" },
    { plan: "Growth", list_price_monthly: 690, typical_segment: "Mid-Market", seats_included: 40, billing: "Annual (price +15% from Apr 2024)" },
    { plan: "Enterprise", list_price_monthly: 4_100, typical_segment: "Enterprise", seats_included: 250, billing: "Annual, custom" },
  ];
  const campaigns = [
    { campaign: "Spring into Lumora — 50% off for 3 months", channel: "Paid social", segment: "SMB", start: "2024-01", end: "ongoing", offer: "50% discount, months 1–3" },
    { campaign: "Search — always on", channel: "Paid search", segment: "SMB / Mid-Market", start: "2022-03", end: "ongoing", offer: "Free 14-day trial" },
    { campaign: "Partner referral programme", channel: "Partners", segment: "Mid-Market / Enterprise", start: "2023-01", end: "ongoing", offer: "15% first-year referral fee" },
  ];
  return { segments: segRows, acquisition: acq, cohorts: cohortRows, serviceCosts: service, support, plans, campaigns };
}

export const saasData = generateSaasData();
