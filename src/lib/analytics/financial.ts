import { type Maybe, isNum, pctChange, safeDivide } from "./numbers";

/** Revenue = Σ price × volume. */
export function revenue(lines: { price: Maybe; volume: Maybe }[]): number | null {
  let total = 0;
  let seen = false;
  for (const l of lines) {
    if (isNum(l.price) && isNum(l.volume)) {
      total += l.price * l.volume;
      seen = true;
    }
  }
  return seen ? total : null;
}

export const revenueGrowth = (current: Maybe, previous: Maybe) => pctChange(current, previous);

export function grossProfit(rev: Maybe, cogs: Maybe): number | null {
  return isNum(rev) && isNum(cogs) ? rev - cogs : null;
}

/** Gross margin as a fraction of revenue. */
export function grossMargin(rev: Maybe, cogs: Maybe): number | null {
  return safeDivide(grossProfit(rev, cogs), rev);
}

/** Contribution = revenue − variable costs. */
export function contribution(rev: Maybe, variableCosts: Maybe): number | null {
  return isNum(rev) && isNum(variableCosts) ? rev - variableCosts : null;
}

export function contributionMargin(rev: Maybe, variableCosts: Maybe): number | null {
  return safeDivide(contribution(rev, variableCosts), rev);
}

export function operatingProfit(gp: Maybe, opex: Maybe): number | null {
  return isNum(gp) && isNum(opex) ? gp - opex : null;
}

export function operatingMargin(opProfit: Maybe, rev: Maybe): number | null {
  return safeDivide(opProfit, rev);
}

/** Break-even revenue = fixed costs / contribution margin ratio. */
export function breakEvenRevenue(fixedCosts: Maybe, cmRatio: Maybe): number | null {
  if (!isNum(cmRatio) || cmRatio <= 0) return null;
  return safeDivide(fixedCosts, cmRatio);
}

/** Break-even volume = fixed costs / (price − variable cost per unit). */
export function breakEvenVolume(fixedCosts: Maybe, price: Maybe, variableCostPerUnit: Maybe): number | null {
  if (!isNum(price) || !isNum(variableCostPerUnit)) return null;
  const unitContribution = price - variableCostPerUnit;
  if (unitContribution <= 0) return null;
  return safeDivide(fixedCosts, unitContribution);
}

/**
 * Decomposes a gross-profit change between two periods into price/volume/mix/cost effects
 * across segments. Each segment supplies units, average price and unit cost per period.
 * Effects sum exactly to the total change.
 */
export interface SegmentPeriod {
  units: number;
  price: number;
  unitCost: number;
}
export interface GpBridge {
  volume: number;
  mix: number;
  price: number;
  cost: number;
  total: number;
}
export function grossProfitBridge(
  segments: { base: SegmentPeriod; current: SegmentPeriod }[],
): GpBridge {
  const baseUnits = segments.reduce((a, s) => a + s.base.units, 0);
  const curUnits = segments.reduce((a, s) => a + s.current.units, 0);
  const baseGp = segments.reduce((a, s) => a + s.base.units * (s.base.price - s.base.unitCost), 0);
  const curGp = segments.reduce((a, s) => a + s.current.units * (s.current.price - s.current.unitCost), 0);
  const baseAvgUnitGp = baseUnits === 0 ? 0 : baseGp / baseUnits;

  const volume = (curUnits - baseUnits) * baseAvgUnitGp;
  // Mix: actual current units at base unit margins vs. current units at the base average margin
  const atBaseMargins = segments.reduce((a, s) => a + s.current.units * (s.base.price - s.base.unitCost), 0);
  const mix = atBaseMargins - curUnits * baseAvgUnitGp;
  const price = segments.reduce((a, s) => a + s.current.units * (s.current.price - s.base.price), 0);
  const cost = -segments.reduce((a, s) => a + s.current.units * (s.current.unitCost - s.base.unitCost), 0);
  return { volume, mix, price, cost, total: curGp - baseGp };
}
