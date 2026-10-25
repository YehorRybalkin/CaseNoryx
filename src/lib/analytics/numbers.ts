/**
 * Numeric primitives shared by every calculation in CaseNoryx.
 *
 * Conventions
 * - Ratios and percentages are returned as fractions (0.125 = 12.5%).
 * - Functions return `null` when a result is undefined (missing data or a zero
 *   denominator) rather than NaN/Infinity, so the UI can render "n/a".
 * - Money is summed in integer cents to avoid binary floating-point drift.
 */

export type Maybe = number | null | undefined;

export function isNum(x: Maybe): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Round half away from zero to `dp` decimal places, robust to 1.005-style errors. */
export function round(x: number, dp = 2): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** dp;
  const shifted = Math.abs(x) * f;
  // toPrecision(15) strips representation noise such as 100.49999999999999
  const r = Math.round(Number(shifted.toPrecision(15)));
  return (Math.sign(x) * r) / f || 0;
}

export function roundOrNull(x: Maybe, dp = 2): number | null {
  return isNum(x) ? round(x, dp) : null;
}

/** a / b, or null when either is missing or b is zero. */
export function safeDivide(a: Maybe, b: Maybe): number | null {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  return a / b;
}

/** Sum ignoring missing values. Returns null only if no value is present. */
export function sum(values: Maybe[]): number | null {
  let total = 0;
  let seen = false;
  for (const v of values) {
    if (isNum(v)) {
      total += v;
      seen = true;
    }
  }
  return seen ? total : null;
}

/** Exact monetary sum (2 dp) computed in integer cents. */
export function sumMoney(values: Maybe[]): number {
  let cents = 0;
  for (const v of values) if (isNum(v)) cents += Math.round(v * 100);
  return cents / 100;
}

export function mean(values: Maybe[]): number | null {
  const nums = values.filter(isNum);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Weighted mean of values by weights, ignoring pairs with missing data. */
export function weightedMean(values: Maybe[], weights: Maybe[]): number | null {
  let num = 0;
  let den = 0;
  values.forEach((v, i) => {
    const w = weights[i];
    if (isNum(v) && isNum(w)) {
      num += v * w;
      den += w;
    }
  });
  return den === 0 ? null : num / den;
}

/** Relative change (current − previous) / |previous|. */
export function pctChange(current: Maybe, previous: Maybe): number | null {
  if (!isNum(current) || !isNum(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/** Difference in percentage points between two fractions (0.32 − 0.30 = 2pp → 0.02). */
export function ppChange(current: Maybe, previous: Maybe): number | null {
  if (!isNum(current) || !isNum(previous)) return null;
  return current - previous;
}

/** Compound annual growth rate over `periods` periods. */
export function cagr(start: Maybe, end: Maybe, periods: number): number | null {
  if (!isNum(start) || !isNum(end) || start <= 0 || end < 0 || periods <= 0) return null;
  return (end / start) ** (1 / periods) - 1;
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** True if `actual` is within an absolute or relative tolerance of `expected`. */
export function withinTolerance(
  actual: number,
  expected: number,
  tol: { abs?: number; rel?: number },
): boolean {
  const diff = Math.abs(actual - expected);
  if (tol.abs !== undefined && diff <= tol.abs + 1e-12) return true;
  if (tol.rel !== undefined && diff <= Math.abs(expected) * tol.rel + 1e-12) return true;
  return false;
}
