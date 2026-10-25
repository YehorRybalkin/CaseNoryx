"use client";

import { Bot, Loader2, Send, Sparkles, Trash2, User } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { COACH_MODES, COACH_MODE_LABELS, type CoachMessage, type CoachMode, type CoachResponse } from "@/lib/coach";
import { cn } from "@/lib/utils";

interface ChatMessage extends CoachMessage {
  source?: "ai" | "offline";
  followUps?: string[];
  analyses?: string[];
  notice?: string;
}

const STARTERS = ["How should I structure this problem?", "Which dataset should I look at first?", "Can you check my hypothesis?", "Explain the key KPI for this case."];

export function CoachChat({ caseSlug, caseTitle, defaultMode, context, className }: { caseSlug: string; caseTitle: string; defaultMode: CoachMode; context?: { activeTab?: string; hypotheses?: string[] }; className?: string }) {
  const storageKey = `cnx.coach.${caseSlug}`;
  const [mode, setMode] = React.useState<CoachMode>(defaultMode);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let stored: ChatMessage[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      stored = raw ? (JSON.parse(raw) as ChatMessage[]).slice(-30) : [];
    } catch {
      stored = [];
    }
    // Reading browser storage is only possible after mount; this is a one-time sync from an external store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(stored);
  }, [storageKey]);
  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {
      /* storage unavailable */
    }
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, storageKey]);

  async function send(text: string) {
    const content = text.trim().slice(0, 2000);
    if (!content || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseSlug, mode, context, messages: next.slice(-24).map(({ role, content, topicId }) => ({ role, content, ...(topicId ? { topicId } : {}) })) }),
      });
      const data = (await res.json()) as CoachResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "The coach is unavailable.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply, topicId: data.topicId, source: data.source, followUps: data.followUpQuestions, analyses: data.suggestedAnalyses, notice: data.notice }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The coach is unavailable.");
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  const last = messages[messages.length - 1];
  return (
    <div className={cn("flex h-full min-h-[480px] flex-col", className)}>
      <div className="flex flex-wrap items-end gap-2 border-b border-border pb-3">
        <div className="min-w-40 flex-1">
          <Label htmlFor={`coach-mode-${caseSlug}`}>Coaching mode</Label>
          <Select id={`coach-mode-${caseSlug}`} className="mt-1" value={mode} onChange={(e) => setMode(e.target.value as CoachMode)}>
            {COACH_MODES.map((m) => <option key={m} value={m}>{COACH_MODE_LABELS[m].label}</option>)}
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMessages([])} disabled={messages.length === 0} aria-label="Clear conversation"><Trash2 /> Clear</Button>
        <p className="w-full text-[11px] text-muted-foreground">{COACH_MODE_LABELS[mode].description}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm">
            <p className="flex items-center gap-2 font-medium"><Sparkles className="size-4 text-accent" /> Your consulting coach for “{caseTitle}”</p>
            <p className="mt-1 text-xs text-muted-foreground">The coach asks questions and gives hints — it will not hand you the answer. Try:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-2">{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
            <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent-soft text-accent")}>
              {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
            </div>
            <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface-2")}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content.replace(/\*\*/g, "")}</p>
              {m.role === "assistant" && (
                <div className="mt-2 space-y-1.5">
                  {m.analyses && m.analyses.length > 0 && (
                    <ul className="list-disc pl-4 text-xs text-muted-foreground">{m.analyses.map((a) => <li key={a}>{a}</li>)}</ul>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={m.source === "ai" ? "accent" : "outline"}>{m.source === "ai" ? "AI-generated" : "Offline hint"}</Badge>
                    {m.notice && <span className="text-[11px] text-muted-foreground">{m.notice}</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="size-3.5 animate-spin" /> Coach is thinking…</div>}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <div ref={endRef} />
      </div>

      {last?.role === "assistant" && last.followUps && last.followUps.length > 0 && !loading && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {last.followUps.map((f) => <button key={f} onClick={() => setInput(f)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-surface-2">{f}</button>)}
        </div>
      )}
      <form className="flex gap-2 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <Textarea
          aria-label="Message the coach"
          rows={2}
          maxLength={2000}
          placeholder="Ask a question or share your reasoning…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
        />
        <Button type="submit" size="icon" className="h-auto self-stretch" disabled={!input.trim() || loading} aria-label="Send message"><Send /></Button>
      </form>
    </div>
  );
}
