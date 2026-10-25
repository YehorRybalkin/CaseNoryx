import { z } from "zod";

export const COACH_MODES = ["interview", "guided", "learning"] as const;
export type CoachMode = (typeof COACH_MODES)[number];
export const COACH_MODE_LABELS: Record<CoachMode, { label: string; description: string }> = {
  interview: { label: "Interview", description: "Minimal assistance. Probing questions only, like a real case interviewer." },
  guided: { label: "Guided", description: "Progressively stronger hints and structured guidance." },
  learning: { label: "Learning", description: "Detailed explanations of methods and frameworks." },
};

export const CoachMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
  topicId: z.string().max(40).optional(),
});
export type CoachMessage = z.infer<typeof CoachMessageSchema>;

export const CoachRequestSchema = z.object({
  caseSlug: z.string().max(64),
  mode: z.enum(COACH_MODES),
  messages: z.array(CoachMessageSchema).min(1).max(24),
  context: z
    .object({
      activeTab: z.string().max(32).optional(),
      hypotheses: z.array(z.string().max(200)).max(20).optional(),
    })
    .optional(),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export interface CoachResponse {
  reply: string;
  followUpQuestions: string[];
  suggestedAnalyses: string[];
  source: "ai" | "offline";
  topicId?: string;
  notice?: string;
}
