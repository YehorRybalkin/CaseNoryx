import { ltv, ltvToCac, safeDivide } from "@/lib/analytics";
import { saasData, type SaasSegment } from "@/lib/cases/saas/data";
import { avgMonthlyChurn, retentionCurve } from "@/lib/cases/saas/metrics";
import type { ScenarioResult } from "@/lib/cases/types";

const H2 = { from: "2024-07", to: "2024-12" };
const COST_PER_TICKET = 5800 / 165 + 2.1;
const TICKETS = { paidSocial: 2.3, smbOther: 0.85, mid: 1.6, ent: 4.2 };
const ONBOARD = { SMB: 145, "Mid-Market": 950, Enterprise: 6500 } as const;
const PRICE_CHURN_ELASTICITY = 0.6;
const PRICE_ACQ_ELASTICITY = -0.5;
const SPEND_RESPONSE = 0.7; // new customers ∝ spend^0.7 (diminishing returns)

const monthlyEquivalentChurn = (retentionAt6: number | null) => (retentionAt6 ? 1 - retentionAt6 ** (1 / 6) : 0);

function base() {
  const dec = saasData.segments.filter((r) => r.month === "2024-12");
  const seg = (s: SaasSegment) => dec.find((r) => r.segment === s)!;
  const h2 = (s: SaasSegment) => saasData.segments.filter((r) => r.segment === s && r.month >= H2.from);
  const acqH2 = (s: SaasSegment, ch?: string) => saasData.acquisition.filter((r) => r.segment === s && r.month >= H2.from && (!ch || r.channel === ch));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const netExp = (s: SaasSegment) => avg(h2(s).map((r) => (r.expansion_mrr - r.contraction_mrr) / r.starting_mrr));
  const newMrrPer = (s: SaasSegment) => h2(s).reduce((a, r) => a + r.new_mrr, 0) / h2(s).reduce((a, r) => a + r.new_customers, 0);
  const perMonth = (rows: { new_customers: number; acquisition_spend: number }[]) => ({
    n: rows.reduce((a, r) => a + r.new_customers, 0) / 6,
    spend: rows.reduce((a, r) => a + r.acquisition_spend, 0) / 6,
  });
  // SMB pools: active customers acquired via 2024 paid social vs. everyone else
  const latestK = (c: (typeof saasData.cohorts)[number]) => c.cohort_month;
  void latestK;
  const psActive = saasData.cohorts
    .filter((c) => c.segment === "SMB" && c.acquisition_channel === "Paid social" && c.cohort_month >= "2024-01")
    .filter((c) => {
      const [y, m] = c.cohort_month.split("-").map(Number);
      return (2024 - y) * 12 + (12 - m) === c.months_since_start;
    })
    .reduce((a, c) => a + c.active_customers, 0);
  const smb = seg("SMB");
  return {
    smb: {
      psCustomers: psActive,
      otherCustomers: smb.ending_customers - psActive,
      arpa: smb.ending_mrr / smb.ending_customers,
      churnPs: monthlyEquivalentChurn(retentionCurve({ segment: "SMB", channel: "Paid social", fromCohort: "2024-01" }, 6)[6].retention),
      churnOther: monthlyEquivalentChurn(retentionCurve({ segment: "SMB", channel: "Paid search", fromCohort: "2024-01" }, 6)[6].retention),
      netExp: netExp("SMB"),
      newMrrPer: smb.ending_mrr / smb.ending_customers,
      ps: perMonth(acqH2("SMB", "Paid social")),
      other: perMonth([...acqH2("SMB", "Paid search"), ...acqH2("SMB", "Organic & referral")]),
    },
    mid: { customers: seg("Mid-Market").ending_customers, mrr: seg("Mid-Market").ending_mrr, churn: avgMonthlyChurn({ segment: "Mid-Market", ...H2 })!, netExp: netExp("Mid-Market"), newMrrPer: newMrrPer("Mid-Market"), acq: perMonth(acqH2("Mid-Market")) },
    ent: { customers: seg("Enterprise").ending_customers, mrr: seg("Enterprise").ending_mrr, churn: avgMonthlyChurn({ segment: "Enterprise", ...H2 })!, netExp: netExp("Enterprise"), newMrrPer: newMrrPer("Enterprise"), acq: perMonth(acqH2("Enterprise")) },
  };
}
const B = base();

export interface SaasInputs {
  smbChurnReduction: number;
  paidSocialSpend: number;
  smbPriceChange: number;
  cacImprovement: number;
}

export function simulateSaas(input: SaasInputs): ScenarioResult {
  const run = (x: SaasInputs) => {
    const p = x.smbPriceChange / 100;
    const churnMult = (1 - x.smbChurnReduction / 100) * (1 + PRICE_CHURN_ELASTICITY * Math.max(0, p));
    const acqMult = Math.max(0, 1 + PRICE_ACQ_ELASTICITY * p);
    const spendRatio = Math.max(0, 1 + x.paidSocialSpend / 100);
    const cacMult = 1 - x.cacImprovement / 100;

    let ps = B.smb.psCustomers, other = B.smb.otherCustomers;
    let smbArpa = B.smb.arpa * (1 + p);
    let mid = B.mid.customers, midMrr = B.mid.mrr;
    let ent = B.ent.customers, entMrr = B.ent.mrr;
    let revenue = 0, serviceCost = 0, acqSpend = 0, churnedTotal = 0, startingTotal = 0, smbChurned = 0, smbStarting = 0, smbNewTotal = 0, smbSpend = 0;

    for (let t = 0; t < 12; t++) {
      const psNew = B.smb.ps.n * spendRatio ** SPEND_RESPONSE * acqMult;
      const otherNew = B.smb.other.n * acqMult;
      const psLost = ps * Math.min(1, B.smb.churnPs * churnMult);
      const otherLost = other * Math.min(1, B.smb.churnOther * churnMult);
      const midLost = mid * B.mid.churn;
      const entLost = ent * B.ent.churn;
      startingTotal += ps + other + mid + ent;
      smbStarting += ps + other;
      churnedTotal += psLost + otherLost + midLost + entLost;
      smbChurned += psLost + otherLost;

      ps = ps - psLost + psNew;
      other = other - otherLost + otherNew;
      smbArpa *= 1 + B.smb.netExp;
      midMrr = midMrr * (1 - B.mid.churn) * (1 + B.mid.netExp) + B.mid.acq.n * B.mid.newMrrPer;
      mid = mid - midLost + B.mid.acq.n;
      entMrr = entMrr * (1 - B.ent.churn) * (1 + B.ent.netExp) + B.ent.acq.n * B.ent.newMrrPer;
      ent = ent - entLost + B.ent.acq.n;

      const smbMrr = (ps + other) * smbArpa;
      const mrr = smbMrr + midMrr + entMrr;
      revenue += mrr;
      const tickets = ps * TICKETS.paidSocial + other * TICKETS.smbOther + mid * TICKETS.mid + ent * TICKETS.ent;
      serviceCost +=
        mrr * 0.075 + 28_000 + tickets * COST_PER_TICKET + 62_000 +
        (psNew + otherNew) * ONBOARD.SMB + B.mid.acq.n * ONBOARD["Mid-Market"] + B.ent.acq.n * ONBOARD.Enterprise +
        smbMrr * 0.029 + (midMrr + entMrr) * 0.004;
      const smbAcq = (B.smb.ps.spend * spendRatio + B.smb.other.spend) * cacMult;
      acqSpend += smbAcq + (B.mid.acq.spend + B.ent.acq.spend) * cacMult;
      smbNewTotal += psNew + otherNew;
      smbSpend += smbAcq;
    }
    const endMrr = (ps + other) * smbArpa + midMrr + entMrr;
    const gm = safeDivide(revenue - serviceCost, revenue);
    const smbChurn = safeDivide(smbChurned, smbStarting);
    const smbCac = safeDivide(smbSpend, smbNewTotal);
    return {
      endCustomers: ps + other + mid + ent,
      endMrr,
      arr: endMrr * 12,
      logoChurn: safeDivide(churnedTotal, startingTotal),
      smbChurn,
      grossMargin: gm,
      smbLtvCac: ltvToCac(ltv({ arpaMonthly: smbArpa, grossMargin: gm, monthlyChurn: smbChurn, maxLifetimeMonths: 60 }), smbCac),
      contribution: revenue - serviceCost - acqSpend,
    };
  };
  return {
    baseline: run({ smbChurnReduction: 0, paidSocialSpend: 0, smbPriceChange: 0, cacImprovement: 0 }),
    scenario: run(input),
    notes: [
      "Projection covers Jan–Dec 2025 starting from December 2024 customers and MRR.",
      "Run-rates: H2 2024 new customers, acquisition spend, net expansion and churn by segment; SMB split into 2024 paid-social cohorts vs. other SMB customers (churn from 6-month cohort retention).",
      `New paid-social customers scale with spend^${SPEND_RESPONSE} (diminishing returns). SMB price increases raise churn with elasticity ${PRICE_CHURN_ELASTICITY} and reduce acquisition with elasticity ${PRICE_ACQ_ELASTICITY}.`,
      "Service costs follow the company's cost drivers: hosting 7.5% of MRR, support per ticket, onboarding per new customer, payment fees.",
      "Contribution = subscription revenue − service costs − acquisition spend (12 months).",
    ],
  };
}
