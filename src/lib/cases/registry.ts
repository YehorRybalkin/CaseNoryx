import { airlineCase } from "./airline/definition";
import { ecommerceCase } from "./ecommerce/definition";
import { manufacturingCase } from "./manufacturing/definition";
import { retailCase } from "./retail/definition";
import { saasCase } from "./saas/definition";
import type { CaseDefinition, CaseSlug, CaseSummary } from "./types";

export const CASES: CaseDefinition[] = [retailCase, saasCase, airlineCase, ecommerceCase, manufacturingCase];
export const CASE_SLUGS = CASES.map((c) => c.slug) as CaseSlug[];

export function getCase(slug: string): CaseDefinition | null {
  return CASES.find((c) => c.slug === slug) ?? null;
}

export function isCaseSlug(slug: string): slug is CaseSlug {
  return CASE_SLUGS.includes(slug as CaseSlug);
}

export function caseSummaries(): CaseSummary[] {
  return CASES.map(({ slug, title, client, industry, difficulty, estimatedMinutes, summary, tags }) => ({
    slug, title, client, industry, difficulty, estimatedMinutes, summary, tags,
  }));
}
