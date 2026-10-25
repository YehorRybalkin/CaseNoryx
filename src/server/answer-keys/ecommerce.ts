import "server-only";
import { pctChange, round } from "@/lib/analytics";
import { CHANNEL_PARAMS } from "@/lib/cases/ecommerce/data";
import { channelSummary, incrementalContribution } from "@/lib/cases/ecommerce/metrics";
import { fmtEurM, fmtPct } from "@/lib/format";
import { simulateEcommerce } from "@/lib/simulation/ecommerce";
import type { AnswerKey } from "./types";

function facts() {
  const t23 = channelSummary({ year: 2023 });
  const t24 = channelSummary({ year: 2024 });
  const ch = (c: Parameters<typeof channelSummary>[0]["channel"], y = 2024) => channelSummary({ year: y, channel: c });
  const social = ch("Paid social"), social23 = ch("Paid social", 2023);
  const display = ch("Display & programmatic"), brand = ch("Paid search – brand"), nonBrand = ch("Paid search – non-brand"), aff = ch("Affiliates"), email = ch("Email & CRM");
  const scenario = simulateEcommerce({ socialBudget: -50, displayBudget: -70, nonBrandBudget: 25, brandBudget: -40, affiliateBudget: -20, cvrImprovement: 0 });
  // Marginal ROAS of the 2023→2024 paid-social expansion
  const marginalSocialRoas = (social.revenue - social23.revenue) / (social.spend - social23.spend);
  return {
    t23, t24, social, social23, display, brand, nonBrand, aff, email, scenario, marginalSocialRoas,
    spendGrowth: pctChange(t24.spend, t23.spend)!,
    revenueGrowth: pctChange(t24.revenue, t23.revenue)!,
    contributionChange: t24.contribution! - t23.contribution!,
    brandIncRoas: brand.roas! * CHANNEL_PARAMS["Paid search – brand"].incrementality,
    brandInc: incrementalContribution(brand, CHANNEL_PARAMS["Paid search – brand"].incrementality)!,
    displayInc: incrementalContribution(display, CHANNEL_PARAMS["Display & programmatic"].incrementality)!,
    socialInc: incrementalContribution(social, CHANNEL_PARAMS["Paid social"].incrementality)!,
  };
}
export const ecomFacts = facts();
const F = ecomFacts;
const pct = (x: number) => round(x * 100, 2);
const m = (x: number) => round(x / 1e6, 2);
const r2 = (x: number) => round(x, 2);

export const ecomAnswerKey: AnswerKey = {
  slug: "ecommerce-marketing",
  mainProblem: `Marketing spend grew ${fmtPct(F.spendGrowth)} while revenue grew ${fmtPct(F.revenueGrowth)}, and contribution after marketing fell ${fmtEurM(Math.abs(F.contributionChange))}: the extra budget went into paid social and display, which operate below their break-even ROAS, while attribution overstates brand search, display and affiliates.`,
  rootCauses: [
    {
      id: "breakeven",
      title: "Budget moved into channels below break-even ROAS",
      explanation: `Paid social (ROAS ${F.social.roas!.toFixed(2)}x vs break-even ${F.social.breakEvenRoas!.toFixed(2)}x) and display (ROAS ${F.display.roas!.toFixed(2)}x vs ${F.display.breakEvenRoas!.toFixed(2)}x) lose ${fmtEurM(Math.abs(F.social.contribution!))} and ${fmtEurM(Math.abs(F.display.contribution!))} respectively in 2024, despite "positive" ROAS.`,
      evidence: ["Channel table: spend, revenue, gross margin, orders", "Break-even ROAS = 1 / (GM − fees − fulfilment/AOV)"],
      driverIds: ["below_breakeven"],
      concepts: [["roas", "contribution", "break-even", "breakeven", "profit"], ["social", "display", "programmatic"]],
      weight: 0.35,
    },
    {
      id: "diminishing",
      title: "Diminishing returns as budgets scaled",
      explanation: `Paid social ROAS fell from ${F.social23.roas!.toFixed(2)}x to ${F.social.roas!.toFixed(2)}x as spend tripled; the marginal ROAS on the extra spend was only ${F.marginalSocialRoas.toFixed(2)}x.`,
      evidence: ["Paid social and display ROAS by month as spend ramps"],
      driverIds: ["diminishing"],
      concepts: [["diminish", "marginal", "saturat", "scal", "declin", "fell", "drop"], ["roas", "return", "efficien"]],
      weight: 0.2,
    },
    {
      id: "attribution",
      title: "Attribution overstates several channels",
      explanation: `Holdout tests show only ${fmtPct(CHANNEL_PARAMS["Paid search – brand"].incrementality)} of brand-search revenue is incremental (incremental ROAS ${F.brandIncRoas.toFixed(2)}x), ${fmtPct(CHANNEL_PARAMS["Display & programmatic"].incrementality)} for display and ${fmtPct(CHANNEL_PARAMS.Affiliates.incrementality)} for affiliates.`,
      evidence: ["Incrementality tests table"],
      driverIds: ["attribution"],
      concepts: [["incremental", "holdout", "attribut", "cannibal", "would have"], ["brand", "display", "affiliate", "search", "channel"]],
      weight: 0.25,
    },
    {
      id: "quality",
      title: "Low-margin, low-loyalty customers from social and display",
      explanation: `Social and affiliates carry lower gross margins (${fmtPct(F.social.grossMargin)}, ${fmtPct(F.aff.grossMargin)}) because of furniture-heavy mix and discounts, and social/display customers repeat far less (14% / 12% within 180 days vs 31% for non-brand search).`,
      evidence: ["Channel × category mix", "Repeat purchase table"],
      driverIds: ["low_margin_mix", "customer_quality"],
      concepts: [["repeat", "retention", "loyal", "lifetime", "ltv", "margin", "discount", "mix"], ["social", "display", "affiliate", "customer", "furniture"]],
      weight: 0.2,
    },
  ],
  driverClassification: {
    below_breakeven: "root",
    diminishing: "root",
    attribution: "root",
    low_margin_mix: "contributing",
    customer_quality: "contributing",
    organic_decline: "distractor",
    email_underperform: "distractor",
    aov_drop: "distractor",
  },
  quantAnswers: {
    spendGrowth: { value: pct(F.spendGrowth), tolerance: { abs: 1.0 }, explanation: "Σ spend 2024 / Σ spend 2023 − 1" },
    socialRoas: { value: r2(F.social.roas!), tolerance: { abs: 0.05 }, explanation: "Paid social revenue / spend, 2024" },
    socialBeRoas: { value: r2(F.social.breakEvenRoas!), tolerance: { abs: 0.1 }, explanation: "1 / (GM − 1.8% − €8.50 / AOV)" },
    socialContribution: { value: m(F.social.contribution!), tolerance: { abs: 0.1 }, explanation: "Revenue × GM − fees − fulfilment − spend" },
    displayContribution: { value: m(F.display.contribution!), tolerance: { abs: 0.08 }, explanation: "Revenue × GM − fees − fulfilment − spend" },
    brandIncRoas: { value: r2(F.brandIncRoas), tolerance: { abs: 0.1 }, explanation: `${F.brand.roas!.toFixed(2)}x × ${CHANNEL_PARAMS["Paid search – brand"].incrementality}` },
    contributionChange: { value: m(F.contributionChange), tolerance: { abs: 0.15 }, explanation: "Total contribution after marketing 2024 − 2023" },
  },
  keyFacts: [
    { id: "sg", label: "Spend growth", value: pct(F.spendGrowth), kind: "percent", tolerance: { abs: 1 } },
    { id: "rg", label: "Revenue growth", value: pct(F.revenueGrowth), kind: "percent", tolerance: { abs: 1 } },
    { id: "cchg", label: "Contribution change", value: m(F.contributionChange), kind: "eur", tolerance: { abs: 0.15 } },
    { id: "sroas", label: "Paid social ROAS", value: r2(F.social.roas!), kind: "ratio", tolerance: { abs: 0.1 } },
    { id: "sroas23", label: "Paid social ROAS 2023", value: r2(F.social23.roas!), kind: "ratio", tolerance: { abs: 0.1 } },
    { id: "sbe", label: "Paid social break-even ROAS", value: r2(F.social.breakEvenRoas!), kind: "ratio", tolerance: { abs: 0.15 } },
    { id: "droas", label: "Display ROAS", value: r2(F.display.roas!), kind: "ratio", tolerance: { abs: 0.1 } },
    { id: "dbe", label: "Display break-even ROAS", value: r2(F.display.breakEvenRoas!), kind: "ratio", tolerance: { abs: 0.15 } },
    { id: "sc", label: "Paid social contribution", value: m(F.social.contribution!), kind: "eur", tolerance: { abs: 0.1 } },
    { id: "dc", label: "Display contribution", value: m(F.display.contribution!), kind: "eur", tolerance: { abs: 0.08 } },
    { id: "bir", label: "Brand incremental ROAS", value: r2(F.brandIncRoas), kind: "ratio", tolerance: { abs: 0.15 } },
    { id: "broas", label: "Brand ROAS", value: r2(F.brand.roas!), kind: "ratio", tolerance: { abs: 0.1 } },
    { id: "binc", label: "Brand incremental share", value: 22, kind: "percent", tolerance: { abs: 1 } },
    { id: "mroas", label: "Marginal paid-social ROAS", value: r2(F.marginalSocialRoas), kind: "ratio", tolerance: { abs: 0.15 } },
    { id: "rep", label: "Social repeat rate", value: 14, kind: "percent", tolerance: { abs: 1 } },
  ],
  recommendationThemes: [
    { id: "cut_social_display", title: "Cut paid social and display back toward break-even", concepts: [["social", "display", "programmatic"], ["cut", "reduc", "lower", "scale back", "decrease", "pause", "halve", "trim", "realloc"]], weight: 0.3 },
    { id: "nonbrand", title: "Reinvest in non-brand search / CRM where contribution is positive", concepts: [["non-brand", "nonbrand", "generic", "email", "crm", "search"], ["increas", "invest", "realloc", "shift", "grow", "scale", "more", "add"]], weight: 0.2 },
    { id: "brand", title: "Cap brand search bids given low incrementality", concepts: [["brand"], ["cap", "reduc", "cut", "lower", "bid", "test", "incremental"]], weight: 0.15 },
    { id: "profit_metric", title: "Steer on contribution / incremental ROAS instead of platform ROAS", concepts: [["contribution", "incremental", "profit", "break-even", "breakeven", "margin"], ["kpi", "target", "steer", "metric", "measure", "optimi", "manage", "bid", "goal"]], weight: 0.2 },
    { id: "test", title: "Institutionalise incrementality testing / MMM", concepts: [["holdout", "incrementality", "test", "experiment", "mmm", "media mix", "lift"], ["regular", "ongoing", "continu", "quarter", "always", "budget", "every", "institution", "routine"]], weight: 0.1 },
    { id: "affiliates", title: "Renegotiate affiliate/coupon terms and discounts", concepts: [["affiliate", "coupon", "cashback", "discount"], ["renegotiat", "commission", "reduc", "cap", "terms", "limit", "remove"]], weight: 0.05 },
  ],
  antiPatterns: [
    { id: "roas_scale", description: "Scaling any channel simply because ROAS > 1x — ROAS is revenue-based and ignores margins and fulfilment.", concepts: [["roas"], ["above 1", "> 1", "greater than 1", "profitable because", "positive return"]] },
    { id: "cut_email", description: "Cutting email/CRM, the most efficient channel.", concepts: [["email", "crm"], ["cut", "reduc", "stop", "pause"]] },
  ],
  alternativeInterpretations: [
    "Paid social may build brand awareness that later converts through organic and brand search; this halo can justify a reduced (not zero) budget if measured with a geo-test.",
    "Customer LTV could rescue part of social acquisition if repeat rates improve via CRM; the 14% repeat rate makes this unlikely without product or offer changes.",
  ],
  commonMistakes: [
    "Treating ROAS > 1 as profitable.",
    "Using a single break-even ROAS for all channels despite different margins and discounts.",
    "Taking platform-attributed revenue at face value.",
    "Judging channels on average rather than marginal returns.",
    "Computing ROAS for organic traffic (zero spend → undefined).",
  ],
  modelRecommendation: {
    executiveSummary: `Brightcart's 2024 marketing expansion destroyed value: spend rose ${fmtPct(F.spendGrowth)} but contribution after marketing fell ${fmtEurM(Math.abs(F.contributionChange))}. Paid social and display run below their break-even ROAS and attribution overstates brand search. Halving social, cutting display by 70%, trimming brand and affiliates and adding 25% to non-brand search raises incrementality-adjusted contribution by about ${fmtEurM((F.scenario.scenario.incrementalContribution ?? 0) - (F.scenario.baseline.incrementalContribution ?? 0))} while cutting spend by ${fmtEurM((F.scenario.baseline.spend ?? 0) - (F.scenario.scenario.spend ?? 0))}.`,
    diagnosis: "Growth was purchased in channels whose marginal economics are negative; dashboards reward revenue (ROAS) rather than contribution and incrementality.",
    rootCauses: `1) Below break-even: social ${F.social.roas!.toFixed(2)}x vs ${F.social.breakEvenRoas!.toFixed(2)}x; display ${F.display.roas!.toFixed(2)}x vs ${F.display.breakEvenRoas!.toFixed(2)}x.\n2) Diminishing returns: marginal social ROAS ${F.marginalSocialRoas.toFixed(2)}x.\n3) Attribution: brand search incremental ROAS only ${F.brandIncRoas.toFixed(2)}x.\n4) Customer quality: low margins (discounts, furniture mix) and 12–14% repeat rates.`,
    quantitativeEvidence: `Social contribution ${fmtEurM(F.social.contribution)}, display ${fmtEurM(F.display.contribution)}; non-brand search +${fmtEurM(F.nonBrand.contribution)} and email +${fmtEurM(F.email.contribution)}.`,
    recommendedActions: "1) Cut paid social by ~50% (keep retargeting) and display by ~70%.\n2) Increase non-brand search by ~25% and invest in CRM lifecycle journeys.\n3) Cap brand search bids; re-test incrementality quarterly.\n4) Renegotiate coupon-affiliate commissions and discount depth.\n5) Replace ROAS targets with channel-specific break-even and incremental-contribution targets.",
    financialImpact: `Simulator: incrementality-adjusted contribution ${fmtEurM(F.scenario.baseline.incrementalContribution)} → ${fmtEurM(F.scenario.scenario.incrementalContribution)}; spend ${fmtEurM(F.scenario.baseline.spend)} → ${fmtEurM(F.scenario.scenario.spend)}; new customers ${Math.round(F.scenario.baseline.newCustomers ?? 0).toLocaleString("en-GB")} → ${Math.round(F.scenario.scenario.newCustomers ?? 0).toLocaleString("en-GB")}.`,
    implementationPriorities: "Month 1: cut display prospecting and lookalike social; set break-even ROAS guardrails per channel. Month 2–3: reinvest in non-brand search and CRM; brand-bid cap test. Quarterly: incrementality tests and budget review.",
    risks: "Fewer new customers in 2025; possible halo effects of social on brand search; competitor bidding on brand terms — monitor via geo-holdouts and adjust.",
  },
  hintTopics: [
    { id: "roas", triggers: ["roas", "return", "profit", "start", "where"], question: "If a channel returns €2.35 of revenue per €1 spent, is it profitable? What else do you need to know?", hints: ["Think about what share of each revenue euro remains after product costs, payment fees and fulfilment.", "Compute break-even ROAS for each channel and compare with actual ROAS."], method: "Break-even ROAS = 1 / net margin per revenue euro, where net margin = gross margin − payment fees − fulfilment cost / AOV. A channel with a 35% gross margin needs a ROAS around 4x just to break even." },
    { id: "marginal", triggers: ["marginal", "diminish", "scale", "budget", "spend"], question: "What did the extra euros spent in 2024 buy, compared with the euros spent in 2023?", hints: ["Compare the change in revenue with the change in spend for paid social between 2023 and 2024."], method: "Budget decisions are made at the margin: marginal ROAS = Δrevenue / Δspend. Average ROAS hides saturation." },
    { id: "incrementality", triggers: ["incremental", "attribution", "brand", "holdout", "test"], question: "Would these sales have happened anyway without the ad?", hints: ["Look at the incrementality tests and multiply each channel's ROAS by its incremental share."], method: "Last-click attribution credits the final touch. Holdout tests estimate what share of that revenue would disappear without the channel; incremental ROAS = ROAS × incremental share." },
    { id: "quality", triggers: ["customer", "repeat", "ltv", "margin", "discount", "mix"], question: "Are all new customers equally valuable?", hints: ["Compare repeat rates by acquisition channel, and gross margins by channel."], method: "A channel's value includes future orders from the customers it acquires; combine margin, repeat rate and orders per customer to compare acquisition quality." },
  ],
};
