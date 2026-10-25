"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import * as svc from "@/server/services";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>, revalidate?: string[]): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    for (const p of revalidate ?? []) revalidatePath(p);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Invalid input." };
    if (err instanceof svc.ServiceError) return { ok: false, error: err.message };
    console.error("[action] unexpected error:", err instanceof Error ? err.message : "unknown");
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const casePath = (slug: string) => `/cases/${encodeURIComponent(slug)}`;

export async function touchProgressAction(slug: string, tab?: string) {
  return run(async () => {
    await svc.touchProgress(slug, tab);
    return null;
  });
}

export async function createHypothesisAction(slug: string, input: unknown) {
  return run(() => svc.createHypothesis(slug, input), [casePath(slug)]);
}
export async function updateHypothesisAction(slug: string, id: string, input: unknown) {
  return run(() => svc.updateHypothesis(id, input), [casePath(slug)]);
}
export async function deleteHypothesisAction(slug: string, id: string) {
  return run(async () => {
    await svc.deleteHypothesis(id);
    return null;
  }, [casePath(slug)]);
}

export async function createNoteAction(slug: string, content: string) {
  return run(() => svc.createNote(slug, content), [casePath(slug)]);
}
export async function deleteNoteAction(slug: string, id: string) {
  return run(async () => {
    await svc.deleteNote(id);
    return null;
  }, [casePath(slug)]);
}

export async function saveScenarioAction(slug: string, input: unknown) {
  return run(() => svc.saveScenario(slug, input), [casePath(slug), "/simulator"]);
}
export async function deleteScenarioAction(slug: string, id: string) {
  return run(async () => {
    await svc.deleteScenario(id);
    return null;
  }, [casePath(slug), "/simulator"]);
}

export async function saveDraftAction(slug: string, content: unknown) {
  return run(() => svc.saveDraft(slug, content));
}

export async function submitRecommendationAction(slug: string) {
  return run(async () => {
    const r = await svc.submitRecommendation(slug);
    return { attempt: r.attempt };
  }, ["/", "/performance", "/cases", casePath(slug)]);
}

export async function retryEvaluationAction(slug: string) {
  return run(async () => {
    const r = await svc.retryEvaluation(slug);
    return { attempt: r.attempt };
  }, ["/", "/performance", casePath(slug)]);
}

export async function startNewAttemptAction(slug: string) {
  return run(async () => {
    await svc.startNewAttempt(slug);
    return null;
  }, ["/", "/cases", casePath(slug)]);
}

export async function updateSettingsAction(input: unknown) {
  return run(() => svc.updateSettings(input), ["/", "/settings"]);
}

export async function resetProgressAction(confirmation: string) {
  return run(async () => {
    if (confirmation !== "RESET") throw new svc.ServiceError("invalid", "Type RESET to confirm.");
    await svc.resetProgress();
    return null;
  }, ["/", "/cases", "/performance", "/simulator"]);
}
