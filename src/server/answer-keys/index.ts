import "server-only";
import type { CaseSlug } from "@/lib/cases/types";
import { airlineAnswerKey } from "./airline";
import { ecomAnswerKey } from "./ecommerce";
import { mfgAnswerKey } from "./manufacturing";
import { retailAnswerKey } from "./retail";
import { saasAnswerKey } from "./saas";
import type { AnswerKey } from "./types";

const KEYS: Record<CaseSlug, AnswerKey> = {
  "retail-profitability": retailAnswerKey,
  "saas-churn": saasAnswerKey,
  "airline-route": airlineAnswerKey,
  "ecommerce-marketing": ecomAnswerKey,
  "manufacturing-ops": mfgAnswerKey,
};

/** Server-only access to answer keys. Never pass the result to a client component. */
export function getAnswerKey(slug: CaseSlug): AnswerKey {
  return KEYS[slug];
}
