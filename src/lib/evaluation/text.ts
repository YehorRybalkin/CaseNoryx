/**
 * Text analysis helpers used by the deterministic grader. These are deliberately
 * transparent: concept matching requires several independent concept groups to
 * co-occur in the same sentence, and numbers are checked against dataset facts.
 */

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function sentences(text: string): string[] {
  return normalise(text)
    .split(/(?<=[.!?;])\s+|\n+|\s-\s|•/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Each group is a list of alternative stems. A sentence matches if every group has a hit. */
export type ConceptGroups = string[][];

export function sentenceMatches(sentence: string, groups: ConceptGroups): boolean {
  return groups.every((alts) => alts.some((a) => sentence.includes(a.toLowerCase())));
}

export function findConcept(text: string, groups: ConceptGroups): string | null {
  for (const s of sentences(text)) if (sentenceMatches(s, groups)) return s;
  return null;
}

export type NumberKind = "percent" | "eur" | "ratio" | "plain";
export interface ExtractedNumber {
  raw: string;
  value: number; // percent → percent units (12.5), eur → EUR millions, ratio → x
  kind: NumberKind;
}

/** Extracts numbers with units: 12.5%, -5.2pp, €11.9m, EUR 4,500, 2.3x, 420k. */
export function extractNumbers(text: string): ExtractedNumber[] {
  const out: ExtractedNumber[] = [];
  const t = text.replace(/[−–—]/g, "-");
  const re = /(-|\+)?\s*(€|eur\s?)?\s*(-|\+)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(%|pp|p\.p\.|percentage points?|bn|billion|m\b|mn\b|million|k\b|thousand|x\b|×)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const [raw, sign1, cur, sign2, num, unitRaw] = m;
    const sign = sign1 ?? sign2;
    if (!num) continue;
    let value = Number(num.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    if (sign === "-") value = -value;
    const unit = (unitRaw ?? "").toLowerCase();
    let kind: NumberKind = "plain";
    if (unit === "%" || unit.startsWith("pp") || unit.startsWith("p.p") || unit.startsWith("percentage")) kind = "percent";
    else if (unit === "x" || unit === "×") kind = "ratio";
    else if (unit === "bn" || unit === "billion") { kind = "eur"; value *= 1000; }
    else if (unit === "m" || unit === "mn" || unit === "million") kind = "eur";
    else if (unit === "k" || unit === "thousand") { kind = "eur"; value /= 1000; }
    else if (cur) { kind = "eur"; value /= 1e6; }
    if (cur && kind === "plain") kind = "eur";
    out.push({ raw: raw.trim(), value, kind });
  }
  return out;
}
