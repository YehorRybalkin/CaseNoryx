import "server-only";
import { round } from "@/lib/analytics";
import * as M from "@/lib/cases/saas/metrics";
import { fmtEur, fmtEurM, fmtPct } from "@/lib/format";
import { simulateSaas } from "@/lib/simulation/saas";
import type { AnswerKey } from "./types";

const Y23 = { from: "2023-07", to: "2023-12" };
const Y24 = { from: "2024-01", to: "2024-12" };
const Q4 = { from: "2024-10", to: "2024-12" };

function facts() {
  const smb24 = M.segmentLtv("SMB", Y24.from, Y24.to);
  const smb23 = M.segmentLtv("SMB", Y23.from, Y23.to);
  const mid24 = M.segmentLtv("Mid-Market", Y24.from, Y24.to);
  const ent24 = M.segmentLtv("Enterprise", Y24.from, Y24.to);
  const curve = (channel: string) => M.retentionCurve({ segment: "SMB", channel, fromCohort: "2024-01" }, 6);
  const ps = curve("Paid social");
  const search = curve("Paid search");
  const supportCost = (f: { from: string; to: string }, months: number) =>
    M.serviceCosts(f) / months;
  const scenario = simulateSaas({ smbChurnReduction: 30, paidSocialSpend: -50, smbPriceChange: 0, cacImprovement: 0 });
  return {
    smbChurn23: M.avgMonthlyChurn({ ...Y23, segment: "SMB" })!,
    smbChurn24: M.avgMonthlyChurn({ ...Y24, segment: "SMB" })!,
    blendedQ4: M.avgMonthlyChurn({ ...Q4, segment: "All" })!,
    blended23: M.avgMonthlyChurn({ ...Y23, segment: "All" })!,
    entNrr: M.compoundedNrr({ ...Y24, segment: "Enterprise" })!,
    smbNrr: M.compoundedNrr({ ...Y24, segment: "SMB" })!,
    midNrr: M.compoundedNrr({ ...Y24, segment: "Mid-Market" })!,
    smbCac23: smb23.cac!, smbCac24: smb24.cac!,
    smbRatio24: smb24.ratio!, smbRatio23: smb23.ratio!, smbLtv24: smb24.ltv!,
    midRatio: mid24.ratio!, entRatio: ent24.ratio!,
    psCac: M.acquisitionCac({ ...Y24, segment: "SMB", channel: "Paid social" })!,
    searchCac: M.acquisitionCac({ ...Y24, segment: "SMB", channel: "Paid search" })!,
    psRet3: ps[3].retention!, psRet2: ps[2].retention!, psRet6: ps[6].retention!, searchRet6: search[6].retention!,
    gm23: M.grossMargin(Y23)!, gm24: M.grossMargin(Y24)!,
    serviceRun23: supportCost(Y23, 6), serviceRun24: supportCost(Q4, 3),
    scenario,
  };
}
export const saasFacts = facts();
const F = saasFacts;
const pct = (x: number) => round(x * 100, 2);

export const saasAnswerKey: AnswerKey = {
  slug: "saas-churn",
  mainProblem: `Growth in 2024 was bought with a discount-led paid-social campaign that acquired low-quality SMB customers: they churn sharply when the discount ends, cost more to acquire (CAC ${fmtEur(F.smbCac23)} → ${fmtEur(F.smbCac24)}) and flood support, so SMB LTV/CAC fell from ${F.smbRatio23.toFixed(1)}x to ${F.smbRatio24.toFixed(1)}x and gross margin slipped ${fmtPct(F.gm23)} → ${fmtPct(F.gm24)}.`,
  rootCauses: [
    {
      id: "promo_churn",
      title: "Promotion-acquired SMB cohorts churn when the discount ends",
      explanation: `2024 paid-social SMB cohorts retain ${fmtPct(F.psRet2)} at month 2 but only ${fmtPct(F.psRet3)} at month 3 — the month the 50% discount expires — and ${fmtPct(F.psRet6)} by month 6 versus ${fmtPct(F.searchRet6)} for paid-search cohorts. SMB monthly churn rose from ${fmtPct(F.smbChurn23)} to ${fmtPct(F.smbChurn24)}.`,
      evidence: ["Cohort retention by channel (month-3 cliff)", "Campaigns table: 50% off for 3 months since Jan 2024"],
      driverIds: ["promo_cohorts"],
      concepts: [["cohort", "promo", "discount", "paid social", "campaign", "month 3", "third month", "introductory"], ["churn", "retention", "retain", "cancel", "drop", "leave"]],
      weight: 0.4,
    },
    {
      id: "unit_economics",
      title: "SMB acquisition economics are no longer viable",
      explanation: `Paid-social CAC reached ${fmtEur(F.psCac)} (vs ${fmtEur(F.searchCac)} for paid search) and SMB CAC overall rose to ${fmtEur(F.smbCac24)}. Combined with higher churn, SMB LTV/CAC is ${F.smbRatio24.toFixed(1)}x, well below the 3x benchmark, while Mid-Market (${F.midRatio.toFixed(1)}x) and Enterprise (${F.entRatio.toFixed(1)}x) remain healthy.`,
      evidence: ["Acquisition table: spend / new customers by channel", "LTV formula with declared assumptions"],
      driverIds: ["paid_social_cac", "smb_mix"],
      concepts: [["cac", "acquisition cost", "ltv", "lifetime value", "unit economic", "payback"], ["smb", "paid social", "small", "channel", "segment"]],
      weight: 0.3,
    },
    {
      id: "support",
      title: "Low-value SMB tickets drive service cost and degrade quality",
      explanation: `Ticket volume roughly doubled; promotion customers raise ~2.3 tickets per month versus ~0.85 for other SMB accounts. Support and onboarding costs pushed gross margin from ${fmtPct(F.gm23)} to ${fmtPct(F.gm24)}, while first-response times deteriorated across all segments.`,
      evidence: ["Support table: tickets per customer, first response hours, CSAT", "Service costs by line"],
      driverIds: ["support_load"],
      concepts: [["support", "ticket", "service cost", "onboarding", "response time", "csat"], ["cost", "margin", "increas", "rise", "rose", "grew", "load", "volume", "slow", "worse"]],
      weight: 0.3,
    },
  ],
  driverClassification: {
    promo_cohorts: "root",
    paid_social_cac: "root",
    support_load: "root",
    smb_mix: "contributing",
    mid_price: "distractor",
    ent_churn: "distractor",
    uptime: "distractor",
    hosting: "distractor",
    seasonality: "distractor",
  },
  quantAnswers: {
    smbChurn2024: { value: pct(F.smbChurn24), tolerance: { abs: 0.2 }, explanation: "Σ SMB churned / Σ SMB starting customers, Jan–Dec 2024" },
    blendedChurnQ4: { value: pct(F.blendedQ4), tolerance: { abs: 0.2 }, explanation: "Σ churned / Σ starting customers, all segments, Oct–Dec 2024" },
    entNrr2024: { value: pct(F.entNrr), tolerance: { abs: 1.0 }, explanation: "Product of monthly (start + expansion − contraction − churned) / start for Enterprise, 2024" },
    smbCac2024: { value: round(F.smbCac24, 0), tolerance: { rel: 0.03 }, explanation: "SMB acquisition spend / new SMB customers, 2024" },
    smbLtvCac2024: { value: round(F.smbRatio24, 2), tolerance: { abs: 0.15 }, explanation: `LTV ${fmtEur(F.smbLtv24)} (ARPA × GM ${fmtPct(F.gm24)} × 1/churn) / CAC ${fmtEur(F.smbCac24)}` },
    gm2024: { value: pct(F.gm24), tolerance: { abs: 0.5 }, explanation: "1 − service costs / subscription revenue (Σ ending MRR), 2024" },
  },
  keyFacts: [
    { id: "smb23", label: "SMB churn H2 2023", value: pct(F.smbChurn23), kind: "percent", tolerance: { abs: 0.2 } },
    { id: "smb24", label: "SMB churn 2024", value: pct(F.smbChurn24), kind: "percent", tolerance: { abs: 0.2 } },
    { id: "q4", label: "Blended churn Q4 2024", value: pct(F.blendedQ4), kind: "percent", tolerance: { abs: 0.2 } },
    { id: "b23", label: "Blended churn H2 2023", value: pct(F.blended23), kind: "percent", tolerance: { abs: 0.2 } },
    { id: "entnrr", label: "Enterprise NRR 2024", value: pct(F.entNrr), kind: "percent", tolerance: { abs: 1 } },
    { id: "smbnrr", label: "SMB NRR 2024", value: pct(F.smbNrr), kind: "percent", tolerance: { abs: 1 } },
    { id: "cac23", label: "SMB CAC H2 2023", value: round(F.smbCac23, 0), kind: "plain", tolerance: { rel: 0.04 } },
    { id: "cac24", label: "SMB CAC 2024", value: round(F.smbCac24, 0), kind: "plain", tolerance: { rel: 0.04 } },
    { id: "pscac", label: "Paid-social CAC 2024", value: round(F.psCac, 0), kind: "plain", tolerance: { rel: 0.04 } },
    { id: "ratio24", label: "SMB LTV/CAC 2024", value: round(F.smbRatio24, 2), kind: "ratio", tolerance: { abs: 0.2 } },
    { id: "ratio23", label: "SMB LTV/CAC H2 2023", value: round(F.smbRatio23, 2), kind: "ratio", tolerance: { abs: 0.25 } },
    { id: "ratioent", label: "Enterprise LTV/CAC", value: round(F.entRatio, 2), kind: "ratio", tolerance: { abs: 0.25 } },
    { id: "ratiomid", label: "Mid-Market LTV/CAC", value: round(F.midRatio, 2), kind: "ratio", tolerance: { abs: 0.25 } },
    { id: "ret3", label: "Paid-social month-3 retention", value: pct(F.psRet3), kind: "percent", tolerance: { abs: 1 } },
    { id: "ret6", label: "Paid-social month-6 retention", value: pct(F.psRet6), kind: "percent", tolerance: { abs: 1 } },
    { id: "gm23", label: "Gross margin H2 2023", value: pct(F.gm23), kind: "percent", tolerance: { abs: 0.5 } },
    { id: "gm24", label: "Gross margin 2024", value: pct(F.gm24), kind: "percent", tolerance: { abs: 0.5 } },
  ],
  recommendationThemes: [
    { id: "promo", title: "Redesign or stop the 50%-off paid-social offer", concepts: [["promo", "discount", "offer", "campaign", "paid social"], ["stop", "end", "redesign", "replace", "cut", "reduc", "annual", "trial", "change", "rework"]], weight: 0.3 },
    { id: "reallocate", title: "Reallocate acquisition budget to higher-LTV channels/segments", concepts: [["budget", "spend", "invest", "realloc", "shift"], ["search", "mid-market", "enterprise", "partner", "organic", "outbound", "channel"]], weight: 0.25 },
    { id: "onboarding", title: "Fix SMB onboarding / activation to reduce early churn", concepts: [["onboard", "activation", "self-serve", "in-app", "time to value", "education", "academy"], ["smb", "churn", "retention", "new", "customer"]], weight: 0.2 },
    { id: "support", title: "Deflect low-value tickets (self-service, tiered support)", concepts: [["support", "ticket"], ["self-serve", "self-service", "deflect", "knowledge base", "tier", "chatbot", "community", "automat", "faq"]], weight: 0.15 },
    { id: "metrics", title: "Manage on cohort LTV/CAC and payback, not sign-ups", concepts: [["ltv", "payback", "cohort", "unit economic", "contribution"], ["kpi", "target", "track", "monitor", "manage", "measure", "incentive", "goal"]], weight: 0.1 },
  ],
  antiPatterns: [
    { id: "cut_ent", description: "Treating the September 2024 enterprise loss as a trend: it was a single acquired account and Enterprise NRR is above 100%.", concepts: [["enterprise"], ["churn", "loss", "trend", "accelerat", "problem", "risk"]] },
    { id: "deeper_discount", description: "Fighting churn with deeper or longer discounts: it raises CAC payback and attracts more price-sensitive customers.", concepts: [["deeper", "bigger", "longer", "extend", "more"], ["discount", "promo"]] },
    { id: "revert_price", description: "Reverting the mid-market price rise: it increased MRR net of downgrades and churn.", concepts: [["revers", "revert", "roll back", "rollback", "undo", "cancel"], ["price"]] },
  ],
  alternativeInterpretations: [
    "Some promotion customers may convert to retained paying accounts after month 3; a narrower offer (e.g. annual-plan discount) can keep the acquisition benefit while filtering for intent.",
    "Support strain may also reflect product complexity for small teams — a lighter Starter onboarding flow is a defensible alternative to cutting acquisition.",
  ],
  commonMistakes: [
    "Using aggregate churn only and missing the cohort/channel signal.",
    "Celebrating customer growth while MRR, NRR and margin deteriorate.",
    "Computing LTV with revenue instead of gross margin, or ignoring the 60-month cap.",
    "Reading ROI from blended CAC, hiding the paid-social channel economics.",
    "Over-reacting to the single enterprise churn in September 2024.",
  ],
  modelRecommendation: {
    executiveSummary: `Lumora's 2024 growth is value-diluting: SMB churn rose to ${fmtPct(F.smbChurn24)} a month and SMB LTV/CAC fell to ${F.smbRatio24.toFixed(1)}x because the 50%-off paid-social offer attracts customers who leave when it ends. We recommend halving paid-social spend, replacing the discount with an annual-plan incentive and investing in SMB onboarding; together this lifts 2025 contribution by about ${fmtEurM((F.scenario.scenario.contribution ?? 0) - (F.scenario.baseline.contribution ?? 0))} while ARR stays broadly flat versus the status quo.`,
    diagnosis: `Customer growth masks value erosion: blended churn rose from ${fmtPct(F.blended23)} to ${fmtPct(F.blendedQ4)} (Q4 2024), gross margin fell to ${fmtPct(F.gm24)}, and almost all of the deterioration sits in 2024 paid-social SMB cohorts. Mid-Market and Enterprise economics remain healthy (LTV/CAC ${F.midRatio.toFixed(1)}x and ${F.entRatio.toFixed(1)}x; Enterprise NRR ${fmtPct(F.entNrr)}).`,
    rootCauses: `1) Discount cliff: paid-social cohorts fall from ${fmtPct(F.psRet2)} to ${fmtPct(F.psRet3)} retention in month 3.\n2) Unit economics: paid-social CAC ${fmtEur(F.psCac)}, SMB LTV/CAC ${F.smbRatio24.toFixed(1)}x.\n3) Support load: promotion accounts generate ~2.7x the tickets of other SMB accounts, raising service costs and response times.`,
    quantitativeEvidence: `SMB churn ${fmtPct(F.smbChurn23)} → ${fmtPct(F.smbChurn24)}; SMB CAC ${fmtEur(F.smbCac23)} → ${fmtEur(F.smbCac24)}; gross margin ${fmtPct(F.gm23)} → ${fmtPct(F.gm24)}; 6-month retention paid social ${fmtPct(F.psRet6)} vs paid search ${fmtPct(F.searchRet6)}.`,
    recommendedActions: "1) Cut paid-social spend by ~50% and end the 3-month 50% discount; offer an annual-plan discount instead.\n2) Launch guided SMB onboarding (in-app checklist, webinars) targeting a 30% reduction in SMB churn.\n3) Move low-complexity tickets to self-service and a community tier.\n4) Reinvest part of the savings in paid search and partners for Mid-Market.\n5) Manage growth on cohort LTV/CAC and CAC payback per channel.",
    financialImpact: `Simulator (SMB churn −30%, paid social −50%): 2025 contribution ${fmtEurM(F.scenario.baseline.contribution)} → ${fmtEurM(F.scenario.scenario.contribution)}; SMB LTV/CAC ${(F.scenario.baseline.smbLtvCac ?? 0).toFixed(1)}x → ${(F.scenario.scenario.smbLtvCac ?? 0).toFixed(1)}x; ARR ${fmtEurM(F.scenario.baseline.arr)} → ${fmtEurM(F.scenario.scenario.arr)}.`,
    implementationPriorities: "Month 0–1: stop the discount and cut paid-social bids. Month 1–3: onboarding programme and ticket deflection. Month 3–6: channel reallocation and LTV/CAC dashboard by cohort.",
    risks: "Lower SMB sign-ups may look like a growth slowdown to investors; onboarding impact is uncertain — run as a controlled experiment on new cohorts and track month-3 retention as the leading indicator.",
  },
  hintTopics: [
    { id: "segment", triggers: ["churn", "segment", "where", "start", "who"], question: "Is churn rising everywhere, or is it concentrated in one segment?", hints: ["Compute pooled monthly churn by segment for H2 2023 and for 2024.", "SMB is the outlier. Now ask which SMB customers churn."], method: "Always decompose an aggregate rate into segments: a blended churn rate can rise purely because the mix moved toward high-churn segments." },
    { id: "cohort", triggers: ["cohort", "retention", "curve", "month", "promo", "discount"], question: "Do customers acquired in 2024 behave like those acquired in 2023? At what age do they leave?", hints: ["Filter the cohort table to SMB and compare channels.", "Look at month 2 versus month 3 retention for 2024 paid-social cohorts — and check the campaign terms."], method: "A retention curve plots the share of a cohort still active by month since acquisition. A sudden drop at a fixed age usually points to a contractual or pricing event, such as a discount ending." },
    { id: "ltv", triggers: ["ltv", "lifetime", "cac", "unit", "economics", "payback"], question: "For every euro spent to acquire an SMB customer, how many euros of gross margin come back?", hints: ["Use the declared formula: LTV = ARPA × gross margin × min(1/churn, 60).", "Compare CAC by channel within SMB — which channel has both the highest CAC and the worst retention?"], method: "LTV/CAC compares gross-margin lifetime value with acquisition cost. Below ~1x the customer never pays back; 3x is a common healthy benchmark. Always state the churn, margin and ARPA assumptions." },
    { id: "margin", triggers: ["margin", "cost", "support", "ticket", "service"], question: "Which cost lines grew faster than revenue, and which customers generate that cost?", hints: ["Compare service costs by line between H2 2023 and Q4 2024.", "Look at tickets per customer by segment and how they evolve after January 2024."], method: "Gross margin = 1 − cost of revenue / revenue. Attribute costs to their drivers (tickets, new customers, MRR) to see which customers are expensive to serve." },
    { id: "price", triggers: ["price", "mid", "growth plan", "increase"], question: "Did the April price increase create or destroy value, net of downgrades and churn?", hints: ["Compare the extra expansion MRR in April with the contraction and churn uplift in April–June."], method: "Evaluate a price change on net MRR: + price uplift on retained customers − downgrades − extra churn. A short-lived churn bump can still be net positive." },
    { id: "enterprise", triggers: ["enterprise", "september", "large"], question: "Is the September enterprise loss a pattern or a single event?", hints: ["Check churned customers and churned MRR for Enterprise month by month, and its NRR for the year."], method: "Before treating an outlier as a trend, test whether it repeats and whether the segment's NRR is still healthy." },
  ],
};
