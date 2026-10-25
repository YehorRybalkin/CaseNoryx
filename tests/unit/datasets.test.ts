import { describe, expect, it } from "vitest";
import { pctChange, sumMoney } from "@/lib/analytics";
import { airlineData, SEATS } from "@/lib/cases/airline/data";
import { BASE_ASSUMPTIONS, routePnl } from "@/lib/cases/airline/model";
import { ecomData, generateEcomData } from "@/lib/cases/ecommerce/data";
import { channelSummary } from "@/lib/cases/ecommerce/metrics";
import { generateMfgData, mfgData, STAGES } from "@/lib/cases/manufacturing/data";
import { plantSummary, stageSummary } from "@/lib/cases/manufacturing/metrics";
import { CASES } from "@/lib/cases/registry";
import { generateRetailData, retailData } from "@/lib/cases/retail/data";
import { pnl, segmentSummary } from "@/lib/cases/retail/metrics";
import { generateSaasData, saasData } from "@/lib/cases/saas/data";
import { avgMonthlyChurn, grossMargin as saasGm, retentionCurve, segmentLtv } from "@/lib/cases/saas/metrics";

const cents = (x: number) => Math.round(x * 100);

describe("registry", () => {
  it("exposes five playable cases with complete definitions", () => {
    expect(CASES).toHaveLength(5);
    for (const c of CASES) {
      expect(c.datasets.length).toBeGreaterThanOrEqual(4);
      expect(c.quantQuestions.length).toBeGreaterThanOrEqual(5);
      expect(c.diagnosisOptions.length).toBeGreaterThanOrEqual(8);
      expect(c.scenario.levers.length).toBeGreaterThanOrEqual(4);
      for (const d of c.datasets) {
        expect(d.rows.length).toBeGreaterThan(0);
        for (const col of d.columns) expect(d.rows[0]).toHaveProperty(col.key);
      }
    }
  });
  it("generators are deterministic (seeded)", () => {
    expect(generateRetailData()).toEqual(generateRetailData());
    expect(generateSaasData()).toEqual(generateSaasData());
    expect(generateEcomData()).toEqual(generateEcomData());
    expect(generateMfgData()).toEqual(generateMfgData());
  });
});

describe("Case 1 — retail dataset", () => {
  it("has internally consistent rows", () => {
    for (const r of retailData.sales) {
      expect(cents(r.net_sales)).toBe(cents(r.gross_sales) - cents(r.returns_value));
      expect(cents(r.gross_profit)).toBe(cents(r.net_sales) - cents(r.cogs));
      expect(r.units_returned).toBeLessThanOrEqual(r.units_sold);
    }
    expect(retailData.sales).toHaveLength(24 * 4 * 5);
  });
  it("returns table reconciles with the sales fact table", () => {
    for (const r of retailData.returns) {
      const rows = retailData.sales.filter((s) => s.month === r.month && s.category === r.category);
      expect(r.units_sold).toBe(rows.reduce((a, s) => a + s.units_sold, 0));
      expect(r.units_returned).toBe(rows.reduce((a, s) => a + s.units_returned, 0));
      expect(cents(r.refund_value)).toBe(cents(sumMoney(rows.map((s) => s.returns_value))));
    }
  });
  it("contains the planted signals", () => {
    const y = (yr: number) => retailData.sales.filter((s) => s.year === yr);
    const o = (yr: number) => retailData.opex.filter((s) => s.year === yr);
    const p23 = pnl(y(2023), o(2023)), p24 = pnl(y(2024), o(2024));
    expect(pctChange(p24.netSales, p23.netSales)!).toBeGreaterThan(0.06);
    expect(p24.operatingProfit).toBeLessThan(p23.operatingProfit * 0.6);
    const c23 = Object.fromEntries(segmentSummary(y(2023), "category").map((c) => [c.key, c]));
    const c24 = Object.fromEntries(segmentSummary(y(2024), "category").map((c) => [c.key, c]));
    expect(c23.Electronics.grossMargin! - c24.Electronics.grossMargin!).toBeGreaterThan(0.08);
    expect(c24.Electronics.share! - c23.Electronics.share!).toBeGreaterThan(0.04);
    expect(c24.Apparel.returnRate! - c23.Apparel.returnRate!).toBeGreaterThan(0.04);
    // Distractors stay flat: food margin and store staff growth near inflation
    expect(Math.abs(c24["Food & Grocery"].grossMargin! - c23["Food & Grocery"].grossMargin!)).toBeLessThan(0.01);
  });
});

describe("Case 2 — SaaS dataset", () => {
  it("customer and MRR movements reconcile row by row and month to month", () => {
    for (const seg of ["SMB", "Mid-Market", "Enterprise"]) {
      const rows = saasData.segments.filter((r) => r.segment === seg);
      rows.forEach((r, i) => {
        expect(r.ending_customers).toBe(r.starting_customers + r.new_customers - r.churned_customers);
        expect(cents(r.ending_mrr)).toBe(cents(r.starting_mrr) + cents(r.new_mrr) + cents(r.expansion_mrr) - cents(r.contraction_mrr) - cents(r.churned_mrr));
        if (i > 0) {
          expect(r.starting_customers).toBe(rows[i - 1].ending_customers);
          expect(Math.abs(r.starting_mrr - rows[i - 1].ending_mrr)).toBeLessThan(0.05);
        }
      });
    }
  });
  it("acquisition table reconciles with new customers", () => {
    for (const r of saasData.segments) {
      const acq = saasData.acquisition.filter((a) => a.month === r.month && a.segment === r.segment);
      expect(acq.reduce((a, x) => a + x.new_customers, 0)).toBe(r.new_customers);
    }
  });
  it("cohort month-0 sizes match acquisitions", () => {
    for (const r of saasData.segments) {
      const c0 = saasData.cohorts.filter((c) => c.cohort_month === r.month && c.segment === r.segment && c.months_since_start === 0);
      expect(c0.reduce((a, c) => a + c.cohort_size, 0)).toBe(r.new_customers);
    }
  });
  it("contains the planted signals", () => {
    expect(avgMonthlyChurn({ segment: "SMB", from: "2024-01", to: "2024-12" })!).toBeGreaterThan(avgMonthlyChurn({ segment: "SMB", from: "2023-07", to: "2023-12" })! + 0.01);
    const ps = retentionCurve({ segment: "SMB", channel: "Paid social", fromCohort: "2024-01" }, 6);
    expect(ps[2].retention! - ps[3].retention!).toBeGreaterThan(0.08); // discount cliff at month 3
    expect(saasGm({ from: "2024-01", to: "2024-12" })!).toBeLessThan(saasGm({ from: "2023-07", to: "2023-12" })!);
    expect(segmentLtv("SMB", "2024-01", "2024-12").ratio!).toBeLessThan(2);
    expect(segmentLtv("Enterprise", "2024-01", "2024-12").ratio!).toBeGreaterThan(3);
  });
});

describe("Case 3 — airline dataset", () => {
  it("capacity equals sectors × seats", () => {
    for (const f of airlineData.forecast) {
      expect(f.seat_capacity).toBe(f.sectors * SEATS);
      expect(f.demand_low).toBeLessThan(f.demand_base);
      expect(f.demand_high).toBeGreaterThan(f.demand_base);
    }
  });
  it("route P&L reconciles and contains the planted decision", () => {
    const p = routePnl(BASE_ASSUMPTIONS);
    expect(p.revenue - p.variableCosts - p.fixedCosts).toBeCloseTo(p.operatingResult, 6);
    expect(p.months.reduce((a, m) => a + m.revenue, 0)).toBeCloseTo(p.revenue, 6);
    expect(p.breakEvenLf!).toBeGreaterThan(p.loadFactor!);
    expect(p.operatingResult).toBeLessThan(0);
    const seasonal = routePnl({ ...BASE_ASSUMPTIONS, winterFrequency: 0 });
    expect(seasonal.operatingResult).toBeGreaterThan(p.operatingResult);
    expect(routePnl({ ...BASE_ASSUMPTIONS, winterFrequency: 0, demandChange: -0.15 }).operatingResult).toBeLessThan(0);
    for (const m of p.months) expect(m.passengers).toBeLessThanOrEqual(m.seats * 0.95 + 1e-9);
  });
});

describe("Case 4 — e-commerce dataset", () => {
  it("campaigns reconcile to 2024 channel totals", () => {
    const channels = [...new Set(ecomData.campaigns.map((c) => c.channel))];
    for (const ch of channels) {
      const rows = ecomData.channels.filter((r) => r.year === 2024 && r.channel === ch);
      const camp = ecomData.campaigns.filter((c) => c.channel === ch);
      expect(cents(sumMoney(camp.map((c) => c.spend)))).toBe(cents(sumMoney(rows.map((r) => r.spend))));
      expect(cents(sumMoney(camp.map((c) => c.revenue)))).toBe(cents(sumMoney(rows.map((r) => r.revenue))));
      expect(camp.reduce((a, c) => a + c.orders, 0)).toBe(rows.reduce((a, r) => a + r.orders, 0));
    }
  });
  it("contains the planted signals", () => {
    const t23 = channelSummary({ year: 2023 }), t24 = channelSummary({ year: 2024 });
    expect(pctChange(t24.spend, t23.spend)!).toBeGreaterThan(pctChange(t24.revenue, t23.revenue)! * 2);
    expect(t24.contribution!).toBeLessThan(t23.contribution!);
    const social = channelSummary({ year: 2024, channel: "Paid social" });
    expect(social.roas!).toBeGreaterThan(1);
    expect(social.roas!).toBeLessThan(social.breakEvenRoas!);
    expect(social.contribution!).toBeLessThan(0);
    expect(channelSummary({ year: 2024, channel: "Organic & direct" }).roas).toBeNull(); // zero spend
  });
});

describe("Case 5 — manufacturing dataset", () => {
  it("production rows are consistent and flow is serial", () => {
    for (const r of mfgData.production) {
      expect(r.good_units).toBe(r.units_processed - r.defective_units);
      expect(r.units_processed).toBeLessThanOrEqual(r.run_hours * r.rated_speed_uph * 1.011);
    }
    for (const m of new Set(mfgData.production.map((r) => r.month))) {
      const [a, b, c] = STAGES.map((s) => mfgData.production.find((r) => r.month === m && r.stage === s)!);
      expect(b.units_processed).toBeLessThanOrEqual(a.good_units);
      expect(c.units_processed).toBeLessThanOrEqual(b.good_units);
    }
  });
  it("order segments reconcile with plant shipments", () => {
    for (const s of mfgData.summary) {
      const rows = mfgData.orders.filter((o) => o.month === s.month);
      expect(rows.reduce((a, r) => a + r.ordered_units, 0)).toBe(s.demand);
      expect(rows.reduce((a, r) => a + r.shipped_on_time, 0)).toBe(s.on_time);
      expect(rows.reduce((a, r) => a + r.shipped_late, 0)).toBe(s.late);
    }
  });
  it("contains the planted signals", () => {
    const y23 = { from: "2023-01", to: "2023-12" }, h2 = { from: "2024-07", to: "2024-12" };
    expect(plantSummary(h2).otd!).toBeLessThan(plantSummary(y23).otd! - 0.05);
    expect(plantSummary(h2).costPerGoodUnit!).toBeGreaterThan(plantSummary(y23).costPerGoodUnit!);
    const cnc = stageSummary("CNC machining", h2);
    expect(cnc.unplannedShare!).toBeGreaterThan(stageSummary("CNC machining", y23).unplannedShare! * 2);
    expect(cnc.defectRate!).toBeGreaterThan(0.04);
    expect(cnc.utilization!).toBeGreaterThan(stageSummary("Stamping", h2).utilization!);
    expect(cnc.effectiveCapacity).toBeLessThan(stageSummary("Coating & assembly", h2).effectiveCapacity);
  });
});
