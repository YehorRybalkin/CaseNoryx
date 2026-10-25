/**
 * Case 4 — Brightcart Home (synthetic online home-goods retailer), 2023–2024.
 * Attributed revenue follows a concave response curve in spend per channel,
 * gross margins derive from each channel's category mix and discount depth.
 */
import { round } from "@/lib/analytics/numbers";
import { createRng, monthIndex, monthRange, yearOf } from "../random";

export const ECOM_SEED = 99_2024;
export const ECOM_MONTHS = monthRange(2023, 1, 24);
export const FULFILMENT_PER_ORDER = 8.5;
export const PAYMENT_FEE_RATE = 0.018;

export const CATEGORIES = { Furniture: 0.31, Textiles: 0.54, Decor: 0.58, Kitchen: 0.42, Lighting: 0.47 } as const;
export type Category = keyof typeof CATEGORIES;

interface ChannelParams {
  spend2023: number;
  spend2024: number;
  roas2023: number; // attributed ROAS at 2023 spend
  beta: number; // response elasticity of revenue to spend
  aov: number;
  cvr: number;
  newShare: number;
  discount: number;
  mix: Record<Category, number>;
  incrementality: number;
  repeat180: number;
  orders12m: number;
}

export const CHANNELS = ["Paid search – brand", "Paid search – non-brand", "Paid social", "Display & programmatic", "Affiliates", "Email & CRM", "Organic & direct"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_PARAMS: Record<Channel, ChannelParams> = {
  "Paid search – brand": { spend2023: 42_000, spend2024: 61_000, roas2023: 9.4, beta: 0.3, aov: 92, cvr: 0.055, newShare: 0.28, discount: 0.03, mix: { Furniture: 0.3, Textiles: 0.22, Decor: 0.2, Kitchen: 0.16, Lighting: 0.12 }, incrementality: 0.22, repeat180: 0.38, orders12m: 2.1 },
  "Paid search – non-brand": { spend2023: 118_000, spend2024: 128_000, roas2023: 4.6, beta: 0.78, aov: 104, cvr: 0.026, newShare: 0.63, discount: 0.04, mix: { Furniture: 0.28, Textiles: 0.24, Decor: 0.18, Kitchen: 0.18, Lighting: 0.12 }, incrementality: 0.86, repeat180: 0.31, orders12m: 1.7 },
  "Paid social": { spend2023: 82_000, spend2024: 255_000, roas2023: 3.5, beta: 0.62, aov: 78, cvr: 0.011, newShare: 0.79, discount: 0.11, mix: { Furniture: 0.46, Textiles: 0.18, Decor: 0.16, Kitchen: 0.12, Lighting: 0.08 }, incrementality: 0.64, repeat180: 0.14, orders12m: 1.2 },
  "Display & programmatic": { spend2023: 28_000, spend2024: 118_000, roas2023: 2.4, beta: 0.55, aov: 84, cvr: 0.006, newShare: 0.71, discount: 0.08, mix: { Furniture: 0.4, Textiles: 0.2, Decor: 0.18, Kitchen: 0.12, Lighting: 0.1 }, incrementality: 0.35, repeat180: 0.12, orders12m: 1.15 },
  Affiliates: { spend2023: 34_000, spend2024: 66_000, roas2023: 6.2, beta: 0.72, aov: 96, cvr: 0.038, newShare: 0.44, discount: 0.15, mix: { Furniture: 0.34, Textiles: 0.22, Decor: 0.16, Kitchen: 0.17, Lighting: 0.11 }, incrementality: 0.45, repeat180: 0.22, orders12m: 1.4 },
  "Email & CRM": { spend2023: 15_000, spend2024: 16_500, roas2023: 17.5, beta: 0.4, aov: 88, cvr: 0.045, newShare: 0.05, discount: 0.06, mix: { Furniture: 0.2, Textiles: 0.28, Decor: 0.24, Kitchen: 0.16, Lighting: 0.12 }, incrementality: 0.55, repeat180: 0.46, orders12m: 2.6 },
  "Organic & direct": { spend2023: 0, spend2024: 0, roas2023: 0, beta: 0, aov: 98, cvr: 0.029, newShare: 0.4, discount: 0.02, mix: { Furniture: 0.29, Textiles: 0.24, Decor: 0.2, Kitchen: 0.16, Lighting: 0.11 }, incrementality: 1, repeat180: 0.35, orders12m: 1.9 },
};
const ORGANIC_REVENUE_2023 = 1_010_000; // monthly average

const SEASON = [0.92, 0.82, 0.92, 0.95, 0.98, 0.9, 0.86, 0.9, 0.98, 1.04, 1.32, 1.41];
const SPEND_SEASON = [0.95, 0.85, 0.95, 0.97, 1.0, 0.92, 0.88, 0.92, 1.0, 1.05, 1.28, 1.23];

/** Gross margin on net (discounted) revenue for a channel. */
export function channelGrossMargin(c: Channel): number {
  const p = CHANNEL_PARAMS[c];
  const listMargin = (Object.keys(p.mix) as Category[]).reduce((a, k) => a + p.mix[k] * CATEGORIES[k], 0);
  return 1 - (1 - listMargin) / (1 - p.discount);
}

/** Attributed revenue for an annualised spend level, from the 2023 calibration point. */
export function responseRevenue(c: Channel, spend: number): number {
  const p = CHANNEL_PARAMS[c];
  if (p.spend2023 === 0) return 0;
  return p.spend2023 * p.roas2023 * (spend / p.spend2023) ** p.beta;
}

export interface EcomChannelRow {
  month: string;
  year: number;
  channel: Channel;
  spend: number;
  sessions: number;
  orders: number;
  revenue: number;
  new_customers: number;
  gross_margin: number;
  discount_rate: number;
}

export function generateEcomData() {
  const rng = createRng(ECOM_SEED);
  const rows: EcomChannelRow[] = [];
  for (const month of ECOM_MONTHS) {
    const y = yearOf(month);
    const m = monthIndex(month) - 1;
    for (const channel of CHANNELS) {
      const p = CHANNEL_PARAMS[channel];
      // spend ramps through 2024 for the expanded channels
      const ramp = y === 2023 ? 0 : Math.min(1, (m + 4) / 9);
      const annualSpend = y === 2023 ? p.spend2023 : p.spend2023 + (p.spend2024 - p.spend2023) * ramp;
      const spend = round(annualSpend * SPEND_SEASON[m] * rng.noise(0.03), 2);
      let revenue: number;
      if (channel === "Organic & direct") {
        revenue = ORGANIC_REVENUE_2023 * (y === 2024 ? 1.035 : 1) * SEASON[m] * rng.noise(0.03);
      } else {
        revenue = responseRevenue(channel, annualSpend) * SEASON[m] * rng.noise(0.04);
      }
      const aov = p.aov * rng.noise(0.02) * (m >= 10 ? 1.04 : 1);
      const orders = Math.round(revenue / aov);
      revenue = round(orders * aov, 2);
      const sessions = Math.round(orders / (p.cvr * rng.noise(0.03)));
      rows.push({
        month, year: y, channel, spend,
        sessions, orders, revenue,
        new_customers: Math.round(orders * p.newShare * rng.noise(0.03)),
        gross_margin: round(channelGrossMargin(channel) + rng.uniform(-0.004, 0.004), 4),
        discount_rate: p.discount,
      });
    }
  }

  // Campaign-level detail for 2024 (splits reconcile to channel totals)
  const splits: Partial<Record<Channel, [string, number, number][]>> = {
    "Paid social": [["Prospecting – lookalike audiences", 0.52, 0.42], ["Flash sale – furniture", 0.31, 0.33], ["Retargeting – cart abandoners", 0.17, 0.25]],
    "Display & programmatic": [["Programmatic prospecting", 0.68, 0.55], ["Retargeting banners", 0.32, 0.45]],
    "Paid search – non-brand": [["Generic – furniture", 0.44, 0.4], ["Generic – textiles & decor", 0.36, 0.41], ["Shopping feed", 0.2, 0.19]],
    "Paid search – brand": [["Brand exact", 0.7, 0.76], ["Brand + product", 0.3, 0.24]],
    Affiliates: [["Coupon & cashback sites", 0.64, 0.7], ["Content & review publishers", 0.36, 0.3]],
    "Email & CRM": [["Newsletters", 0.45, 0.4], ["Lifecycle automations", 0.55, 0.6]],
  };
  const campaigns: { campaign: string; channel: Channel; spend: number; revenue: number; orders: number }[] = [];
  for (const [channel, parts] of Object.entries(splits) as [Channel, [string, number, number][]][]) {
    const r = rows.filter((x) => x.year === 2024 && x.channel === channel);
    const spend = r.reduce((a, x) => a + Math.round(x.spend * 100), 0) / 100;
    const revenue = r.reduce((a, x) => a + Math.round(x.revenue * 100), 0) / 100;
    const orders = r.reduce((a, x) => a + x.orders, 0);
    let sSpend = 0, sRev = 0, sOrd = 0;
    parts.forEach(([name, sShare, rShare], i) => {
      const last = i === parts.length - 1;
      const cs = last ? round(spend - sSpend, 2) : round(spend * sShare, 2);
      const cr = last ? round(revenue - sRev, 2) : round(revenue * rShare, 2);
      const co = last ? orders - sOrd : Math.round(orders * rShare);
      sSpend += cs; sRev += cr; sOrd += co;
      campaigns.push({ campaign: name, channel, spend: cs, revenue: cr, orders: co });
    });
  }

  const categories = (Object.keys(CATEGORIES) as Category[]).map((c) => ({
    category: c,
    gross_margin_at_list: CATEGORIES[c],
    return_rate: { Furniture: 0.06, Textiles: 0.09, Decor: 0.05, Kitchen: 0.04, Lighting: 0.05 }[c],
    avg_item_price: { Furniture: 289, Textiles: 46, Decor: 32, Kitchen: 41, Lighting: 74 }[c],
  }));
  const channelMix = CHANNELS.flatMap((ch) =>
    (Object.keys(CATEGORIES) as Category[]).map((cat) => ({ channel: ch, category: cat, revenue_share: CHANNEL_PARAMS[ch].mix[cat], avg_discount: CHANNEL_PARAMS[ch].discount })),
  );
  const repeat = CHANNELS.map((ch) => ({
    acquisition_channel: ch,
    new_customers_2024: rows.filter((r) => r.year === 2024 && r.channel === ch).reduce((a, r) => a + r.new_customers, 0),
    repeat_rate_180d: CHANNEL_PARAMS[ch].repeat180,
    orders_per_customer_12m: CHANNEL_PARAMS[ch].orders12m,
  }));
  const incrementality = [
    { channel: "Paid search – brand", method: "Geo holdout (8 regions)", period: "Mar–Apr 2024", incremental_share: CHANNEL_PARAMS["Paid search – brand"].incrementality, confidence: "High" },
    { channel: "Paid search – non-brand", method: "Geo holdout (8 regions)", period: "Mar–Apr 2024", incremental_share: CHANNEL_PARAMS["Paid search – non-brand"].incrementality, confidence: "High" },
    { channel: "Paid social", method: "Platform conversion-lift study", period: "Jun 2024", incremental_share: CHANNEL_PARAMS["Paid social"].incrementality, confidence: "Medium" },
    { channel: "Display & programmatic", method: "PSA ghost-ad test", period: "Sep 2024", incremental_share: CHANNEL_PARAMS["Display & programmatic"].incrementality, confidence: "Medium" },
    { channel: "Affiliates", method: "Coupon-site pause test", period: "Oct 2024", incremental_share: CHANNEL_PARAMS.Affiliates.incrementality, confidence: "Medium" },
    { channel: "Email & CRM", method: "Random holdout (10% of list)", period: "2024 rolling", incremental_share: CHANNEL_PARAMS["Email & CRM"].incrementality, confidence: "High" },
  ];
  return { channels: rows, campaigns, categories, channelMix, repeat, incrementality };
}

export const ecomData = generateEcomData();
