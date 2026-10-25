import type { CaseDefinition, CaseSlug, ScenarioResult } from "@/lib/cases/types";
import { simulateAirline, type AirlineInputs } from "./airline";
import { simulateEcommerce, type EcomInputs } from "./ecommerce";
import { simulateManufacturing, type MfgInputs } from "./manufacturing";
import { simulateRetail, type RetailInputs } from "./retail";
import { simulateSaas, type SaasInputs } from "./saas";

export type LeverValues = Record<string, number>;

/** Fills missing levers with defaults and clamps every value to its declared range. */
export function normaliseInputs(def: CaseDefinition, input: LeverValues): LeverValues {
  const out: LeverValues = {};
  for (const l of def.scenario.levers) {
    const v = Number(input[l.id]);
    out[l.id] = Number.isFinite(v) ? Math.min(l.max, Math.max(l.min, v)) : l.defaultValue;
  }
  return out;
}

export function defaultInputs(def: CaseDefinition): LeverValues {
  return Object.fromEntries(def.scenario.levers.map((l) => [l.id, l.defaultValue]));
}

export function simulate(slug: CaseSlug, x: LeverValues): ScenarioResult {
  switch (slug) {
    case "retail-profitability":
      return simulateRetail(x as unknown as RetailInputs);
    case "saas-churn":
      return simulateSaas(x as unknown as SaasInputs);
    case "airline-route":
      return simulateAirline(x as unknown as AirlineInputs);
    case "ecommerce-marketing":
      return simulateEcommerce(x as unknown as EcomInputs);
    case "manufacturing-ops":
      return simulateManufacturing(x as unknown as MfgInputs);
  }
}
