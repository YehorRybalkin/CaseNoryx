import { describe, expect, it } from "vitest";
import * as A from "@/lib/analytics";

describe("numeric primitives", () => {
  it("rounds half away from zero without binary artefacts", () => {
    expect(A.round(1.005, 2)).toBe(1.01);
    expect(A.round(-1.005, 2)).toBe(-1.01);
    expect(A.round(2.675, 2)).toBe(2.68);
    expect(A.round(0.1 + 0.2, 10)).toBe(0.3);
  });
  it("returns null for zero or missing denominators", () => {
    expect(A.safeDivide(1, 0)).toBeNull();
    expect(A.safeDivide(null, 3)).toBeNull();
    expect(A.safeDivide(1, Number.NaN)).toBeNull();
    expect(A.safeDivide(6, 3)).toBe(2);
  });
  it("sums money exactly in cents", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(A.sumMoney([0.1, 0.2])).toBe(0.3);
    expect(A.sumMoney(Array(1000).fill(0.01))).toBe(10);
    expect(A.sumMoney([1.11, null, undefined, 2.22])).toBe(3.33);
  });
  it("ignores missing values in sums and means", () => {
    expect(A.sum([1, null, 2])).toBe(3);
    expect(A.sum([null, undefined])).toBeNull();
    expect(A.mean([2, null, 4])).toBe(3);
    expect(A.weightedMean([10, 20], [1, 3])).toBe(17.5);
  });
  it("computes growth and percentage-point changes", () => {
    expect(A.pctChange(110, 100)).toBeCloseTo(0.1, 12);
    expect(A.pctChange(-50, -100)).toBeCloseTo(0.5, 12);
    expect(A.pctChange(5, 0)).toBeNull();
    expect(A.ppChange(0.333, 0.385)).toBeCloseTo(-0.052, 12);
    expect(A.cagr(100, 121, 2)).toBeCloseTo(0.1, 12);
  });
  it("checks tolerances", () => {
    expect(A.withinTolerance(10.2, 10, { abs: 0.2 })).toBe(true);
    expect(A.withinTolerance(10.3, 10, { abs: 0.2 })).toBe(false);
    expect(A.withinTolerance(103, 100, { rel: 0.03 })).toBe(true);
  });
});

describe("financial formulas", () => {
  it("computes revenue, margins and operating profit", () => {
    expect(A.revenue([{ price: 10, volume: 5 }, { price: 2, volume: 10 }])).toBe(70);
    expect(A.grossProfit(1000, 620)).toBe(380);
    expect(A.grossMargin(1000, 620)).toBeCloseTo(0.38, 12);
    expect(A.grossMargin(0, 10)).toBeNull();
    expect(A.operatingProfit(380, 290)).toBe(90);
    expect(A.operatingMargin(90, 1000)).toBeCloseTo(0.09, 12);
    expect(A.contributionMargin(40, 25)).toBeCloseTo(0.375, 12);
  });
  it("computes break-even volume and revenue", () => {
    expect(A.breakEvenVolume(500_000, 40, 25)).toBeCloseTo(33_333.333, 2);
    expect(A.breakEvenRevenue(500_000, 0.375)).toBeCloseTo(1_333_333.33, 1);
    expect(A.breakEvenVolume(100, 20, 25)).toBeNull(); // negative unit contribution
    expect(A.breakEvenRevenue(100, 0)).toBeNull();
  });
  it("gross-profit bridge effects sum exactly to the total change", () => {
    const b = A.grossProfitBridge([
      { base: { units: 100, price: 10, unitCost: 6 }, current: { units: 150, price: 9, unitCost: 6.5 } },
      { base: { units: 200, price: 5, unitCost: 2 }, current: { units: 190, price: 5.2, unitCost: 2 } },
    ]);
    expect(b.volume + b.mix + b.price + b.cost).toBeCloseTo(b.total, 9);
    expect(b.price).toBeCloseTo(150 * -1 + 190 * 0.2, 9);
    expect(b.cost).toBeCloseTo(-150 * 0.5, 9);
  });
});

describe("customer analytics", () => {
  it("computes churn, retention and MRR", () => {
    expect(A.churnRate(40, 1000)).toBeCloseTo(0.04, 12);
    expect(A.retentionRate(40, 1000)).toBeCloseTo(0.96, 12);
    expect(A.churnRate(1, 0)).toBeNull();
    expect(A.endingMrr({ starting: 1000, newMrr: 100, expansion: 50, contraction: 20, churned: 30 })).toBe(1100);
  });
  it("computes NRR and GRR excluding new business", () => {
    expect(A.netRevenueRetention({ starting: 1000, expansion: 50, contraction: 20, churned: 30 })).toBeCloseTo(1, 12);
    expect(A.grossRevenueRetention({ starting: 1000, contraction: 20, churned: 30 })).toBeCloseTo(0.95, 12);
    expect(A.netRevenueRetention({ starting: 0, expansion: 1, contraction: 0, churned: 0 })).toBeNull();
  });
  it("computes LTV with a lifetime cap and LTV/CAC", () => {
    expect(A.ltv({ arpaMonthly: 100, grossMargin: 0.6, monthlyChurn: 0.05 })).toBeCloseTo(1200, 9);
    expect(A.ltv({ arpaMonthly: 100, grossMargin: 0.6, monthlyChurn: 0.001, maxLifetimeMonths: 60 })).toBeCloseTo(3600, 9);
    expect(A.ltv({ arpaMonthly: 100, grossMargin: 0.6, monthlyChurn: 0 })).toBeCloseTo(3600, 9);
    expect(A.ltv({ arpaMonthly: null, grossMargin: 0.6, monthlyChurn: 0.05 })).toBeNull();
    expect(A.ltvToCac(1200, 400)).toBe(3);
    expect(A.cac(10_000, 25)).toBe(400);
    expect(A.cacPaybackMonths(400, 100, 0.6)).toBeCloseTo(6.6667, 3);
  });
});

describe("marketing analytics", () => {
  it("separates ROAS from profitability", () => {
    expect(A.roas(235_000, 100_000)).toBeCloseTo(2.35, 12);
    const c = A.marketingContribution({ revenue: 235_000, grossMargin: 0.35, orders: 3_000, fulfilmentPerOrder: 8.5, paymentFeeRate: 0.018, spend: 100_000 });
    expect(c).toBeCloseTo(235_000 * 0.35 - 25_500 - 4_230 - 100_000, 6);
    expect(c!).toBeLessThan(0); // ROAS > 1 but loss-making
    const be = A.breakEvenRoas({ grossMargin: 0.35, paymentFeeRate: 0.018, fulfilmentPerOrder: 8.5, aov: 235_000 / 3_000 });
    expect(be!).toBeGreaterThan(2.35);
    expect(A.breakEvenRoas({ grossMargin: 0.01, paymentFeeRate: 0.02 })).toBeNull();
  });
  it("computes funnel metrics", () => {
    expect(A.conversionRate(2_750, 250_000)).toBeCloseTo(0.011, 12);
    expect(A.averageOrderValue(214_500, 2_750)).toBeCloseTo(78, 12);
    expect(A.marketingCac(60_000, 0)).toBeNull();
  });
});

describe("operations analytics", () => {
  it("computes utilisation, defects, yield and unit cost", () => {
    expect(A.capacityUtilization(54_000, 60_000)).toBeCloseTo(0.9, 12);
    expect(A.defectRate(3_000, 54_000)).toBeCloseTo(0.05556, 4);
    expect(A.productionYield(51_000, 54_000)).toBeCloseTo(0.9444, 4);
    expect(A.costPerGoodUnit(1_600_000, 51_000)).toBeCloseTo(31.37, 2);
    expect(A.onTimeDelivery(45_000, 51_000)).toBeCloseTo(0.88235, 4);
    expect(A.availability(500, 50)).toBeCloseTo(0.9, 12);
  });
  it("finds the bottleneck of a serial line", () => {
    expect(A.serialThroughput([64_000, 52_000, 60_000])).toBe(52_000);
    expect(A.bottleneckIndex([64_000, 52_000, 60_000])).toBe(1);
    expect(A.serialThroughput([null, undefined])).toBeNull();
  });
});
