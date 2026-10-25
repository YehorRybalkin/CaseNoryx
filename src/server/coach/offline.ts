import "server-only";
import type { CoachMessage, CoachMode, CoachResponse } from "@/lib/coach";
import type { CaseSlug } from "@/lib/cases/types";
import { getAnswerKey } from "../answer-keys";
import { CONCEPTS } from "./concepts";

const GENERIC_FOLLOW_UPS: Record<CoachMode, string[]> = {
  interview: ["What would you need to see in the data to reject that idea?", "How would you quantify the size of that effect?"],
  guided: ["Which dataset would you open first to test this?", "What result would confirm your hypothesis?"],
  learning: ["Would you like a worked example of the calculation?", "Which part of the method is unclear?"],
};

/**
 * Deterministic, case-specific coaching used when AI is unavailable. Routes the
 * learner's latest message to a hint topic and escalates hint strength per topic.
 */
export function offlineCoach(slug: CaseSlug, mode: CoachMode, messages: CoachMessage[]): CoachResponse {
  const key = getAnswerKey(slug);
  const last = [...messages].reverse().find((m) => m.role === "user")?.content.toLowerCase() ?? "";
  const visited = messages.filter((m) => m.role === "assistant" && m.topicId).map((m) => m.topicId as string);

  const scored = key.hintTopics
    .map((t) => ({ t, score: t.triggers.reduce((a, trig) => a + (last.includes(trig) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score);
  const topic = scored[0].score > 0 ? scored[0].t : key.hintTopics.find((t) => !visited.includes(t.id)) ?? key.hintTopics[0];
  const level = visited.filter((v) => v === topic.id).length;
  const concept = CONCEPTS.find((c) => c.triggers.some((t) => last.includes(t)));

  let reply: string;
  let suggested: string[] = [];
  if (mode === "interview") {
    reply = level === 0 ? topic.question : `Let me push you further: ${topic.hints[0].replace(/^[A-Z]/, (c) => c.toLowerCase())} What do you find, and what does it imply?`;
  } else if (mode === "guided") {
    const hint = topic.hints[Math.min(level, topic.hints.length - 1)];
    reply = `${level === 0 ? topic.question + "\n\n" : ""}Hint ${Math.min(level, topic.hints.length - 1) + 1} of ${topic.hints.length}: ${hint}`;
    if (level >= topic.hints.length) reply += "\n\nYou have all the hints for this area — try writing down your conclusion and the number that supports it.";
    suggested = topic.hints.slice(0, Math.min(level + 1, topic.hints.length));
  } else {
    reply = `${concept ? `**${concept.title}.** ${concept.text}\n\n` : ""}**Method for this case.** ${topic.method}\n\nTry it: ${topic.hints[0]}`;
    suggested = [topic.hints[0]];
  }
  return {
    reply,
    followUpQuestions: GENERIC_FOLLOW_UPS[mode],
    suggestedAnalyses: suggested,
    source: "offline",
    topicId: topic.id,
  };
}
