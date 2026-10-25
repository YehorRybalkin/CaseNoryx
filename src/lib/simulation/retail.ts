import { grossMargin, operatingMargin, safeDivide, sumMoney } from "@/lib/analytics";
import { retailData } from "@/lib/cases/retail/data";
import type { ScenarioResult } from "@/lib/cases/types";

export const RETAIL_ELASTICITY = -1.5;
const WRITE_OFF = 0.25;
const RETURN_HANDLING = 4.6;
const ELEC_DELIVERY = 6.1;

/** FY2024 base-year building blocks, derived from the dataset. */
function base() {
  const s = retailData.sales.filter((r) => r.year === 2024);
  const o = retailData.opex.filter((r) => r.year === 2024);
  const cat = (c: string) => {
    const rows = s.filter((r) => r.category === c);
    const units = rows.reduce((a, r) => a + r.units_sold, 0);
    const returned = rows.reduce((a, r) => a + r.units_returned, 0);
    const gross = sumMoney(rows.map((r) => r.gross_sales));
    const net = sumMoney(rows.map((r) => r.net_sales));
    const cogs = sumMoney(rows.map((r) => r.cogs));
    const r = returned / units;
    return { units, returned, gross, net, cogs, price: gross / units, r, unitCost: cogs / (units * (1 - r + r * WRITE_OFF)) };
  };
  const opexBy = (line: string) => sumMoney(o.filter((r) => r.expense_line === line).map((r) => r.amount));
  const totalNet = sumMoney(s.map((r) => r.net_sales));
  const totalCogs = sumMoney(s.map((r) => r.cogs));
  return {
    elec: cat("Electronics"),
    apparel: cat("Apparel"),
    home: cat("Home & Living"),
    totalNet,
    totalCogs,
    opexTotal: sumMoney(o.map((r) => r.amount)),
    marketing: opexBy("Marketing"),
    logistics: opexBy("Logistics & distribution"),
  };
}
const B = base();

export interface RetailInputs {
  elecPrice: number;
  elecCost: number;
  apparelReturns: number;
  mixShift: number;
  opexSavings: number;
}

export function simulateRetail(input: RetailInputs): ScenarioResult {
  const compute = (x: RetailInputs) => {
    const dp = x.elecPrice / 100;
    // Electronics
    const eUnits = Math.max(0, B.elec.units * (1 + RETAIL_ELASTICITY * dp));
    const ePrice = B.elec.price * (1 + dp);
    const eCost = B.elec.unitCost * (1 - x.elecCost / 100);
    const eNetFull = eUnits * ePrice * (1 - B.elec.r);
    const eCogsFull = eUnits * eCost * (1 - B.elec.r + B.elec.r * WRITE_OFF);
    const keep = 1 - x.mixShift / 100;
    const eNet = eNetFull * keep;
    const eCogs = eCogsFull * keep;
    // Home & Living absorbs shifted sales at its own margin
    const homeMargin = (B.home.net - B.home.cogs) / B.home.net;
    const shifted = eNetFull * (1 - keep);
    const hNet = B.home.net + shifted;
    const hCogs = B.home.cogs + shifted * (1 - homeMargin);
    // Apparel returns
    const r = Math.max(0, B.apparel.r + x.apparelReturns / 100);
    const aNet = B.apparel.gross * (1 - r);
    const aCogs = B.apparel.unitCost * B.apparel.units * (1 - r + r * WRITE_OFF);
    const aReturned = B.apparel.units * r;

    const otherNet = B.totalNet - B.elec.net - B.apparel.net - B.home.net;
    const otherCogs = B.totalCogs - B.elec.cogs - B.apparel.cogs - B.home.cogs;
    const netSales = eNet + hNet + aNet + otherNet;
    const cogs = eCogs + hCogs + aCogs + otherCogs;
    const grossProfit = netSales - cogs;

    // Variable logistics effects, then savings on controllable lines
    const logistics =
      B.logistics + (aReturned - B.apparel.returned) * RETURN_HANDLING + (eUnits * keep - B.elec.units) * ELEC_DELIVERY;
    const savings = (x.opexSavings / 100) * (B.marketing + logistics);
    const opex = B.opexTotal - B.logistics + logistics - savings;
    const operatingProfit = grossProfit - opex;
    return {
      netSales,
      grossProfit,
      grossMargin: grossMargin(netSales, cogs),
      elecMargin: safeDivide(eNetFull - eCogsFull, eNetFull),
      opex,
      operatingProfit,
      operatingMargin: operatingMargin(operatingProfit, netSales),
    };
  };
  const defaults: RetailInputs = { elecPrice: 0, elecCost: 0, apparelReturns: 0, mixShift: 0, opexSavings: 0 };
  return {
    baseline: compute(defaults),
    scenario: compute(input),
    notes: [
      "Baseline = FY2024 actuals, rebuilt from the sales and opex datasets.",
      `Electronics volume responds to price with elasticity ${RETAIL_ELASTICITY} (linear approximation).`,
      "Shifted electronics sales are assumed to be replaced by Home & Living sales at the FY2024 Home & Living gross margin.",
      "Returns handling (€4.60/unit) and electronics home delivery (€6.10/unit) flex with volumes; savings apply to marketing and logistics.",
    ],
  };
}

export const retailBaseInfo = { apparelReturnRate: B.apparel.r, elecUnitCost: B.elec.unitCost, elecPrice: B.elec.price };
