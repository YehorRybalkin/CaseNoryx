"use client";
import { getCase } from "@/lib/cases/registry";
import type { CaseSlug } from "@/lib/cases/types";
import { ScenarioSimulator, type SavedScenarioView } from "./scenario-simulator";

export function SimulatorPageClient({ slug, saved }: { slug: CaseSlug; saved: SavedScenarioView[] }) {
  const def = getCase(slug)!;
  return <ScenarioSimulator key={slug} def={def} saved={saved} />;
}
