import { NextResponse } from "next/server";
import { CoachRequestSchema, type CoachResponse } from "@/lib/coach";
import { getCase } from "@/lib/cases/registry";
import { AiError, describeAiError } from "@/server/ai/client";
import { aiCoach } from "@/server/ai/coach";
import { offlineCoach } from "@/server/coach/offline";
import { aiConfigured } from "@/server/env";
import { getSettings } from "@/server/services";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = CoachRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid coach request." }, { status: 400 });
  const def = getCase(parsed.data.caseSlug);
  if (!def) return NextResponse.json({ error: "Unknown case." }, { status: 404 });
  const { mode, messages, context } = parsed.data;

  const settings = await getSettings();
  if (settings.aiCoachEnabled && aiConfigured()) {
    try {
      const res = await aiCoach(def, mode, messages, context);
      return NextResponse.json(res satisfies CoachResponse);
    } catch (err) {
      const notice = err instanceof AiError ? err.message : describeAiError("api_error");
      const res = offlineCoach(def.slug, mode, messages);
      return NextResponse.json({ ...res, notice: `${notice} Showing offline guidance instead.` } satisfies CoachResponse);
    }
  }
  const res = offlineCoach(def.slug, mode, messages);
  const notice = !settings.aiCoachEnabled ? "AI coach is turned off in Settings — offline case hints." : "Offline mode (no ANTHROPIC_API_KEY) — case-specific hints.";
  return NextResponse.json({ ...res, notice } satisfies CoachResponse);
}
