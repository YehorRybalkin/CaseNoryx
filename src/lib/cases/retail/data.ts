/**
 * Case 1 — Nordhaven Retail Group (synthetic).
 * 24 months (FY2023–FY2024) of sales by month × region × category, operating
 * expenses, returns, promotions and a store reference table.
 * Seeded generator: identical output on every run.
 */
import { round } from "@/lib/analytics/numbers";
import { createRng, monthIndex, monthRange, yearOf } from "../random";

export const RETAIL_SEED = 20240611;
export const RETAIL_MONTHS = monthRange(2023, 1, 24);
export const RETAIL_REGIONS = ["North", "South", "East", "West"] as const;
export const RETAIL_CATEGORIES = ["Apparel", "Home & Living", "Electronics", "Beauty", "Food & Grocery"] as const;
export type RetailRegion = (typeof RETAIL_REGIONS)[number];
export type RetailCategory = (typeof RETAIL_CATEGORIES)[number];

export interface RetailSalesRow {
  month: string;
  year: number;
  region: RetailRegion;
  category: RetailCategory;
  units_sold: number;
  avg_selling_price: number;
  gross_sales: number;
  units_returned: number;
  returns_value: number;
  net_sales: number;
  cogs: number;
  gross_profit: number;
  gross_margin: number;
}

export interface RetailOpexRow {
  month: string;
  year: number;
  expense_line: string;
  amount: number;
}

export interface RetailReturnsRow {
  month: string;
  year: number;
  category: RetailCategory;
  units_sold: number;
  units_returned: number;
  return_rate: number;
  refund_value: number;
  top_return_reason: string;
}

interface CategoryParams {
  units: number; // FY23 average monthly units, group level
  price: number;
  unitCost: number;
  returnRate: number;
  growth2024: number; // underlying volume growth
  season: number[]; // 12 multipliers
}

const FLAT = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const PARAMS: Record<RetailCategory, CategoryParams> = {
  Apparel: { units: 210_000, price: 38, unitCost: 17.5, returnRate: 0.07, growth2024: 0.015,
    season: [0.92, 0.78, 1.02, 1.06, 1.0, 0.95, 0.96, 0.9, 1.04, 1.08, 1.1, 1.19] },
  "Home & Living": { units: 60_000, price: 62, unitCost: 34, returnRate: 0.03, growth2024: 0.01,
    season: [0.88, 0.86, 0.97, 1.05, 1.08, 1.02, 0.95, 0.94, 1.0, 1.02, 1.06, 1.17] },
  Electronics: { units: 28_000, price: 240, unitCost: 186, returnRate: 0.04, growth2024: 0.0,
    season: [0.82, 0.74, 0.84, 0.86, 0.88, 0.9, 0.92, 0.95, 0.98, 1.0, 1.55, 1.56] },
  Beauty: { units: 95_000, price: 21, unitCost: 9.5, returnRate: 0.02, growth2024: 0.03,
    season: [0.86, 0.95, 0.98, 0.97, 1.02, 0.96, 0.94, 0.93, 0.98, 1.0, 1.1, 1.31] },
  "Food & Grocery": { units: 400_000, price: 8.5, unitCost: 6.3, returnRate: 0.0, growth2024: 0.02, season: FLAT },
};

/** Share of each category's volume sold in each region. */
const REGION_SHARE: Record<RetailRegion, number> = { North: 0.31, South: 0.24, East: 0.19, West: 0.26 };
/** Electronics promotion ("TechDeals") volume response is stronger in South and West. */
const TECHDEALS_REGION_LIFT: Record<RetailRegion, number> = { North: 1.32, South: 1.62, East: 1.3, West: 1.55 };

const WRITE_OFF_SHARE = 0.25; // share of returned units that cannot be resold (cost lands in COGS)

function electronicsPriceFactor(ym: string): number {
  if (yearOf(ym) < 2024) return 1;
  return monthIndex(ym) === 1 ? 0.99 : 0.915; // TechDeals launched Feb 2024
}
function electronicsCostFactor(ym: string): number {
  return yearOf(ym) < 2024 ? 1 : 1.045; // supplier price increase + EUR/USD, Jan 2024
}
function apparelSaleFactor(ym: string): number {
  const m = monthIndex(ym);
  return m === 1 || m === 7 ? 0.86 : 1; // seasonal clearance — both years
}
function returnRate(cat: RetailCategory, ym: string): number {
  const base = PARAMS[cat].returnRate;
  if (cat === "Apparel" && yearOf(ym) === 2024 && monthIndex(ym) >= 3) return 0.131; // free-returns policy from Mar 2024
  return base;
}

export function generateRetailData() {
  const rng = createRng(RETAIL_SEED);
  const sales: RetailSalesRow[] = [];

  for (const month of RETAIL_MONTHS) {
    const y = yearOf(month);
    const m = monthIndex(month);
    for (const region of RETAIL_REGIONS) {
      for (const category of RETAIL_CATEGORIES) {
        const p = PARAMS[category];
        let units = p.units * REGION_SHARE[region] * p.season[m - 1];
        if (y === 2024) units *= 1 + p.growth2024;
        if (category === "Electronics" && y === 2024 && m >= 2) units *= TECHDEALS_REGION_LIFT[region];
        // East region store refurbishment (May–Jun 2024): temporary, all categories
        if (region === "East" && y === 2024 && (m === 5 || m === 6)) units *= 0.9;
        if (category === "Apparel") units *= apparelSaleFactor(month) < 1 ? 1.18 : 1; // clearance boosts volume
        units = Math.round(units * rng.noise(0.035));

        let price = p.price * rng.noise(0.012);
        if (category === "Electronics") price *= electronicsPriceFactor(month);
        if (category === "Apparel") price *= apparelSaleFactor(month);
        if (y === 2024 && category !== "Electronics") price *= 1.012; // modest list-price indexation
        price = round(price, 2);

        let unitCost = p.unitCost * rng.noise(0.008);
        if (category === "Electronics") unitCost *= electronicsCostFactor(month);
        if (y === 2024 && category !== "Electronics") unitCost *= 1.012;

        const rr = returnRate(category, month) * rng.noise(0.06);
        const returned = Math.round(units * rr);
        const gross = round(units * price, 2);
        const returnsValue = round(returned * price, 2);
        const net = round(gross - returnsValue, 2);
        const cogs = round(unitCost * (units - returned) + unitCost * returned * WRITE_OFF_SHARE, 2);
        const gp = round(net - cogs, 2);
        sales.push({
          month, year: y, region, category,
          units_sold: units,
          avg_selling_price: price,
          gross_sales: gross,
          units_returned: returned,
          returns_value: returnsValue,
          net_sales: net,
          cogs,
          gross_profit: gp,
          gross_margin: round(gp / net, 4),
        });
      }
    }
  }

  // Operating expenses (group level)
  const opex: RetailOpexRow[] = [];
  for (const month of RETAIL_MONTHS) {
    const y = yearOf(month);
    const m = monthIndex(month);
    const monthSales = sales.filter((s) => s.month === month);
    const returnedUnits = monthSales.reduce((a, s) => a + s.units_returned, 0);
    const electronicsUnits = monthSales.filter((s) => s.category === "Electronics").reduce((a, s) => a + s.units_sold, 0);
    const peak = m === 11 || m === 12 ? 1.08 : 1;
    const lines: [string, number][] = [
      ["Store staff", 2_850_000 * (y === 2024 ? 1.034 : 1) * peak * rng.noise(0.01)],
      ["Rent & occupancy", 2_110_000 * (y === 2024 ? 1.021 : 1)],
      // fixed network cost + €4.60 handling per returned unit + €6.10 home delivery per electronics unit
      ["Logistics & distribution", 610_000 * (y === 2024 ? 1.02 : 1) + returnedUnits * 4.6 + electronicsUnits * 6.1 * (y === 2024 ? 1 : 0.55)],
      ["Marketing", (y === 2024 ? 700_000 : 600_000) * (m === 11 || m === 12 ? 1.35 : 1) * rng.noise(0.02)],
      ["Head office & IT", 505_000 * (y === 2024 ? 1.03 : 1) * rng.noise(0.01)],
      ["Utilities", 228_000 * (y === 2024 ? 0.94 : 1) * (m <= 2 || m === 12 ? 1.15 : 1)],
    ];
    for (const [expense_line, amount] of lines) opex.push({ month, year: y, expense_line, amount: round(amount, 2) });
  }

  // Returns summary (group level), reconciles with the sales table
  const reasons: Record<RetailCategory, [string, string]> = {
    Apparel: ["Size / fit", "Changed mind (free returns)"],
    "Home & Living": ["Damaged in transit", "Damaged in transit"],
    Electronics: ["Defective", "Defective"],
    Beauty: ["Allergic reaction", "Allergic reaction"],
    "Food & Grocery": ["n/a", "n/a"],
  };
  const returns: RetailReturnsRow[] = [];
  for (const month of RETAIL_MONTHS) {
    for (const category of RETAIL_CATEGORIES) {
      const rows = sales.filter((s) => s.month === month && s.category === category);
      const sold = rows.reduce((a, s) => a + s.units_sold, 0);
      const ret = rows.reduce((a, s) => a + s.units_returned, 0);
      const refund = round(rows.reduce((a, s) => a + Math.round(s.returns_value * 100), 0) / 100, 2);
      const after = yearOf(month) === 2024 && monthIndex(month) >= 3;
      returns.push({
        month, year: yearOf(month), category,
        units_sold: sold,
        units_returned: ret,
        return_rate: sold === 0 ? 0 : round(ret / sold, 4),
        refund_value: refund,
        top_return_reason: reasons[category][after ? 1 : 0],
      });
    }
  }

  const promotions = [
    { period: "Jan 2023", category: "Apparel", promotion: "Winter clearance", avg_discount: 0.14, channel: "Stores + online" },
    { period: "Jul 2023", category: "Apparel", promotion: "Summer clearance", avg_discount: 0.14, channel: "Stores + online" },
    { period: "Nov 2023", category: "All", promotion: "Black Friday weekend", avg_discount: 0.1, channel: "Stores + online" },
    { period: "Jan 2024", category: "Apparel", promotion: "Winter clearance", avg_discount: 0.14, channel: "Stores + online" },
    { period: "Feb–Dec 2024", category: "Electronics", promotion: "TechDeals always-on price programme", avg_discount: 0.085, channel: "Stores + online" },
    { period: "Mar–Dec 2024", category: "Apparel", promotion: "Free returns on all apparel orders", avg_discount: 0, channel: "Online + stores" },
    { period: "Jul 2024", category: "Apparel", promotion: "Summer clearance", avg_discount: 0.14, channel: "Stores + online" },
    { period: "Nov 2024", category: "All", promotion: "Black Friday weekend", avg_discount: 0.1, channel: "Stores + online" },
  ];

  const stores = [
    { region: "North", stores: 42, selling_area_sqm: 151_200, store_staff_fte: 1_090, customer_nps_2024: 41, refurbished_2024: "No" },
    { region: "South", stores: 33, selling_area_sqm: 115_500, store_staff_fte: 845, customer_nps_2024: 44, refurbished_2024: "No" },
    { region: "East", stores: 27, selling_area_sqm: 91_800, store_staff_fte: 690, customer_nps_2024: 37, refurbished_2024: "Yes (May–Jun)" },
    { region: "West", stores: 36, selling_area_sqm: 126_000, store_staff_fte: 930, customer_nps_2024: 43, refurbished_2024: "No" },
  ];

  return { sales, opex, returns, promotions, stores };
}

export const retailData = generateRetailData();
