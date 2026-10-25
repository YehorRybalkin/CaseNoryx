/** Presentation formatting. Never used inside calculations. */
import type { ValueFormat } from "./cases/types";

const nf = (dp: number) => new Intl.NumberFormat("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function fmtNumber(x: number | null | undefined, dp = 0): string {
  return x === null || x === undefined || !Number.isFinite(x) ? "n/a" : nf(dp).format(x);
}

/** Fraction → percent string. */
export function fmtPct(x: number | null | undefined, dp = 1): string {
  return x === null || x === undefined || !Number.isFinite(x) ? "n/a" : `${nf(dp).format(x * 100)}%`;
}

/** Fraction difference → percentage points. */
export function fmtPp(x: number | null | undefined, dp = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  const v = x * 100;
  return `${v > 0 ? "+" : ""}${nf(dp).format(v)}pp`;
}

export function fmtEur(x: number | null | undefined, dp = 0): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  return `${x < 0 ? "−" : ""}€${nf(dp).format(Math.abs(x))}`;
}

/** EUR in millions, e.g. €12.3m. */
export function fmtEurM(x: number | null | undefined, dp = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  return `${x < 0 ? "−" : ""}€${nf(dp).format(Math.abs(x) / 1e6)}m`;
}

/** Compact EUR for chart axes. */
export function fmtEurCompact(x: number): string {
  const a = Math.abs(x);
  const sign = x < 0 ? "−" : "";
  if (a >= 1e9) return `${sign}€${(a / 1e9).toFixed(1)}bn`;
  if (a >= 1e6) return `${sign}€${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${sign}€${(a / 1e3).toFixed(0)}k`;
  return `${sign}€${a.toFixed(0)}`;
}

export function fmtSignedPct(x: number | null | undefined, dp = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  return `${x > 0 ? "+" : ""}${nf(dp).format(x * 100)}%`;
}

export function formatValue(x: number | null | undefined, format: ValueFormat): string {
  switch (format) {
    case "currency":
      return fmtEur(x, 0);
    case "currencyM":
      return fmtEurM(x, 2);
    case "percent":
      return fmtPct(x, 1);
    case "integer":
      return fmtNumber(x, 0);
    case "ratio":
      return x === null || x === undefined || !Number.isFinite(x) ? "n/a" : `${nf(2).format(x)}x`;
    case "months":
      return x === null || x === undefined || !Number.isFinite(x) ? "n/a" : `${nf(1).format(x)} mo`;
    default:
      return fmtNumber(x, 2);
  }
}

/** Formats a delta between two values in the metric's own units. */
export function formatDelta(delta: number | null, format: ValueFormat): string {
  if (delta === null || !Number.isFinite(delta)) return "n/a";
  if (Math.abs(delta) < 1e-9) return "±0";
  const sign = delta > 0 ? "+" : "−";
  switch (format) {
    case "percent":
      return `${sign}${nf(1).format(Math.abs(delta) * 100)}pp`;
    case "currencyM":
      return `${sign}€${nf(2).format(Math.abs(delta) / 1e6)}m`;
    case "currency":
      return `${sign}€${nf(0).format(Math.abs(delta))}`;
    case "ratio":
      return `${sign}${nf(2).format(Math.abs(delta))}x`;
    case "months":
      return `${sign}${nf(1).format(Math.abs(delta))} mo`;
    default:
      return `${sign}${nf(format === "integer" ? 0 : 2).format(Math.abs(delta))}`;
  }
}

export function fmtDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

export function fmtDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}
