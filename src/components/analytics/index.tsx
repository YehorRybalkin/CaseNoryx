"use client";
import type { CaseSlug } from "@/lib/cases/types";
import { AirlineAnalytics } from "./airline";
import { EcommerceAnalytics } from "./ecommerce";
import { ManufacturingAnalytics } from "./manufacturing";
import { RetailAnalytics } from "./retail";
import { SaasAnalytics } from "./saas";

export function CaseAnalytics({ slug }: { slug: CaseSlug }) {
  switch (slug) {
    case "retail-profitability": return <RetailAnalytics />;
    case "saas-churn": return <SaasAnalytics />;
    case "airline-route": return <AirlineAnalytics />;
    case "ecommerce-marketing": return <EcommerceAnalytics />;
    case "manufacturing-ops": return <ManufacturingAnalytics />;
  }
}
