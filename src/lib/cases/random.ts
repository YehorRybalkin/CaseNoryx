/** Deterministic PRNG (mulberry32) so every dataset is reproducible from its seed. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Uniform in [min, max). */
    uniform: (min: number, max: number) => min + (max - min) * next(),
    /** Multiplicative noise factor in [1 − pct, 1 + pct]. */
    noise: (pct: number) => 1 + (next() * 2 - 1) * pct,
    /** Approximately normal (Irwin–Hall, n = 6). */
    normal: (mean: number, sd: number) => {
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return mean + (s - 3) * sd * Math.SQRT2;
    },
  };
}
export type Rng = ReturnType<typeof createRng>;

export function monthRange(startYear: number, startMonth: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = startMonth - 1 + i;
    const y = startYear + Math.floor(m / 12);
    out.push(`${y}-${String((m % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

export const monthIndex = (ym: string) => Number(ym.slice(5, 7)); // 1-12
export const yearOf = (ym: string) => Number(ym.slice(0, 4));
