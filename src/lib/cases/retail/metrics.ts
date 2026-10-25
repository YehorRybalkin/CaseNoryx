/** Aggregations over the retail dataset. Shared by analytics, simulator and grading. */
import { grossMargin, operatingMargin, pctChange, safeDivide, sumMoney } from "@/lib/analytics";
import type { RetailOpexRow, RetailSalesRow } from "./data";

export interface PnlSummary {
  grossSales: number;
  returnsValue: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number | null;
  opex: number;
  operatingProfit: number;
  operatingMargin: number | null;
  unitsSold: number;
  unitsReturned: number;
  returnRate: number | null;
}

export function pnl(sales: RetailSalesRow[], opex: RetailOpexRow[]): PnlSummary {
  const netSales = sumMoney(sales.map((s) => s.net_sales));
  const cogs = sumMoney(sales.map((s) => s.cogs));
  const grossProfit = sumMoney(sales.map((s) => s.gross_profit));
  const opexTotal = sumMoney(opex.map((o) => o.amount));
  const operatingProfit = Math.round((grossProfit - opexTotal) * 100) / 100;
  const unitsSold = sales.reduce((a, s) => a + s.units_sold, 0);
  const unitsReturned = sales.reduce((a, s) => a + s.units_returned, 0);
  return {
    grossSales: sumMoney(sales.map((s) => s.gross_sales)),
    returnsValue: sumMoney(sales.map((s) => s.returns_value)),
    netSales,
    cogs,
    grossProfit,
    grossMargin: grossMargin(netSales, cogs),
    opex: opexTotal,
    operatingProfit,
    operatingMargin: operatingMargin(operatingProfit, netSales),
    unitsSold,
    unitsReturned,
    returnRate: safeDivide(unitsReturned, unitsSold),
  };
}

export function groupBy<T, K extends string | number>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export interface SegmentSummary {
  key: string;
  netSales: number;
  grossProfit: number;
  grossMargin: number | null;
  units: number;
  avgPrice: number | null;
  unitCost: number | null;
  returnRate: number | null;
  share: number | null;
}

export function segmentSummary(sales: RetailSalesRow[], by: "category" | "region"): SegmentSummary[] {
  const total = sumMoney(sales.map((s) => s.net_sales));
  return [...groupBy(sales, (s) => s[by]).entries()].map(([key, rows]) => {
    const netSales = sumMoney(rows.map((r) => r.net_sales));
    const cogs = sumMoney(rows.map((r) => r.cogs));
    const units = rows.reduce((a, r) => a + r.units_sold, 0);
    const returned = rows.reduce((a, r) => a + r.units_returned, 0);
    const gross = sumMoney(rows.map((r) => r.gross_sales));
    return {
      key,
      netSales,
      grossProfit: sumMoney(rows.map((r) => r.gross_profit)),
      grossMargin: grossMargin(netSales, cogs),
      units,
      avgPrice: safeDivide(gross, units),
      unitCost: null,
      returnRate: safeDivide(returned, units),
      share: safeDivide(netSales, total),
    };
  });
}

export function yoy(current: number | null, previous: number | null) {
  return pctChange(current, previous);
}
