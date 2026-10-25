"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, FileCheck2, Loader2, Lock, RefreshCcw, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { retryEvaluationAction, saveDraftAction, startNewAttemptAction, submitRecommendationAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Callout } from "@/components/ui/misc";
import { Checkbox } from "@/components/ui/slider";
import type { CaseDefinition } from "@/lib/cases/types";
import { fmtDateTime } from "@/lib/format";
import { MAX_SECTION_CHARS, RECOMMENDATION_SECTIONS, isSubmittable, type RecommendationContent } from "@/lib/recommendation";

const FormSchema = z.object({
  executiveSummary: z.string().max(MAX_SECTION_CHARS),
  diagnosis: z.string().max(MAX_SECTION_CHARS),
  rootCauses: z.string().max(MAX_SECTION_CHARS),
  quantitativeEvidence: z.string().max(MAX_SECTION_CHARS),
  recommendedActions: z.string().max(MAX_SECTION_CHARS),
  financialImpact: z.string().max(MAX_SECTION_CHARS),
  implementationPriorities: z.string().max(MAX_SECTION_CHARS),
  risks: z.string().max(MAX_SECTION_CHARS),
  selectedDrivers: z.array(z.string()),
  quant: z.record(z.string(), z.string().refine((v) => v.trim() === "" || Number.isFinite(Number(v.replace(",", "."))), "Enter a number")),
});
type FormValues = z.infer<typeof FormSchema>;

function toContent(v: FormValues): RecommendationContent {
  const { quant, ...rest } = v;
  return {
    ...rest,
    quantAnswers: Object.fromEntries(Object.entries(quant).map(([k, s]) => [k, s.trim() === "" ? null : Number(s.replace(",", "."))])),
  };
}
function toForm(c: RecommendationContent, def: CaseDefinition): FormValues {
  const { quantAnswers, ...rest } = c;
  return { ...rest, quant: Object.fromEntries(def.quantQuestions.map((q) => [q.id, quantAnswers[q.id] === null || quantAnswers[q.id] === undefined ? "" : String(quantAnswers[q.id])])) };
}

export function RecommendationForm({
  def, initial, status, attempts, lastSavedAt, submittedSnapshot, pendingEvaluation,
}: {
  def: CaseDefinition;
  initial: RecommendationContent;
  status: "in_progress" | "submitted" | "completed";
  attempts: number;
  lastSavedAt: string | null;
  submittedSnapshot: { attempt: number; submittedAt: string; content: RecommendationContent } | null;
  pendingEvaluation: boolean;
}) {
  const router = useRouter();
  const locked = status !== "in_progress";
  const { register, control, watch, getValues, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(FormSchema), defaultValues: toForm(initial, def), mode: "onChange" });
  const [savedAt, setSavedAt] = React.useState<string | null>(lastSavedAt);
  const [saveState, setSaveState] = React.useState<"idle" | "dirty" | "saving" | "error">("idle");
  const [submitting, setSubmitting] = React.useState(false);
  const values = watch();
  const content = toContent(values);
  const completeness = isSubmittable(content);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = React.useRef(JSON.stringify(toContent(getValues())));

  const save = React.useCallback(async (manual = false) => {
    const parsed = FormSchema.safeParse(getValues());
    if (!parsed.success) { if (manual) toast.error("Fix the highlighted fields before saving."); return false; }
    const c = toContent(parsed.data);
    const json = JSON.stringify(c);
    if (json === lastSaved.current && !manual) return true;
    setSaveState("saving");
    const res = await saveDraftAction(def.slug, c);
    if (!res.ok) { setSaveState("error"); toast.error(res.error); return false; }
    lastSaved.current = json;
    setSavedAt(new Date(res.data.updatedAt).toISOString());
    setSaveState("idle");
    if (manual) toast.success("Draft saved");
    return true;
  }, [def.slug, getValues]);

  // Debounced autosave
  React.useEffect(() => {
    if (locked) return;
    const sub = watch(() => {
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(false), 1500);
    });
    return () => { sub.unsubscribe(); if (timer.current) clearTimeout(timer.current); };
  }, [watch, save, locked]);

  // Warn before leaving with unsaved changes
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (saveState === "dirty" || saveState === "saving") e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  async function submit() {
    setSubmitting(true);
    const ok = await save(false);
    if (!ok) { setSubmitting(false); return; }
    const res = await submitRecommendationAction(def.slug);
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Attempt ${res.data.attempt} submitted and evaluated`);
    router.push(`/cases/${def.slug}/review`);
    router.refresh();
  }

  if (locked && submittedSnapshot) {
    return (
      <div className="space-y-4">
        <Callout tone={pendingEvaluation ? "warning" : "success"} title={pendingEvaluation ? "Submitted — evaluation incomplete" : `Attempt ${submittedSnapshot.attempt} submitted and locked`}>
          Submitted {fmtDateTime(submittedSnapshot.submittedAt)}. The snapshot below is read-only. {pendingEvaluation ? "The evaluation did not finish; you can retry it." : "Review your evaluation and compare it with the model solution."}
        </Callout>
        <div className="flex flex-wrap gap-2">
          {pendingEvaluation ? (
            <Button onClick={async () => { const r = await retryEvaluationAction(def.slug); if (r.ok) { toast.success("Evaluation complete"); router.push(`/cases/${def.slug}/review`); } else toast.error(r.error); }}><RefreshCcw /> Retry evaluation</Button>
          ) : (
            <Button asChild><Link href={`/cases/${def.slug}/review`}><FileCheck2 /> View evaluation</Link></Button>
          )}
          {status === "completed" && (
            <ConfirmDialog
              trigger={<Button variant="outline"><RefreshCcw /> Start new attempt</Button>}
              title="Start a new attempt?"
              description={`Your previous submission and its evaluation stay locked in your history. Your draft will be re-opened for editing as attempt ${attempts + 1}.`}
              confirmLabel="Start new attempt"
              onConfirm={async () => { const r = await startNewAttemptAction(def.slug); if (r.ok) { toast.success("New attempt started"); router.refresh(); } else toast.error(r.error); }}
            />
          )}
        </div>
        <SnapshotView def={def} content={submittedSnapshot.content} />
      </div>
    );
  }

  return (
    <form className="grid gap-4 lg:grid-cols-3" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="space-y-4 lg:col-span-2">
        {attempts > 0 && <Callout title={`Attempt ${attempts + 1}`}>Your previous submissions remain locked in the review page. This draft starts from your last submission.</Callout>}
        {RECOMMENDATION_SECTIONS.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <Label htmlFor={`rec-${s.key}`} className="text-sm font-semibold text-foreground">{s.label}</Label>
              <CardDescription>{s.help}</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea id={`rec-${s.key}`} rows={s.rows} aria-invalid={!!errors[s.key]} {...register(s.key)} />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>{values[s.key].trim().length < 15 ? "Required before submission" : ""}</span>
                <span className="tabular">{values[s.key].length.toLocaleString("en-GB")} / {MAX_SECTION_CHARS.toLocaleString("en-GB")}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Submission</CardTitle>
            <CardDescription>
              {saveState === "saving" ? <span className="inline-flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Saving…</span>
                : saveState === "dirty" ? "Unsaved changes"
                : saveState === "error" ? <span className="text-danger">Autosave failed</span>
                : savedAt ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3 text-success" /> Draft saved {fmtDateTime(savedAt)}</span> : "Not saved yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs">
              <div className="font-medium">{8 - completeness.missing.length} of 8 sections complete</div>
              {completeness.missing.length > 0 && <div className="mt-1 text-muted-foreground">Missing: {completeness.missing.map((m) => m.replace(/^\d\.\s/, "")).join(", ")}</div>}
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => save(true)}><Save /> Save draft</Button>
            <ConfirmDialog
              trigger={<Button type="button" className="w-full" disabled={!completeness.ok || submitting}>{submitting ? <><Loader2 className="animate-spin" /> Evaluating…</> : <><Send /> Submit for evaluation</>}</Button>}
              title="Submit your recommendation?"
              description={<>Your recommendation will be <strong>locked</strong> as attempt {attempts + 1} and evaluated. The answer key and model solution become visible after submission. You can start a new attempt later, but this snapshot cannot be changed.</>}
              confirmLabel="Submit and evaluate"
              onConfirm={submit}
            />
            {submitting && <p className="text-xs text-muted-foreground" role="status">Grading your submission. AI evaluation (if enabled) can take up to a minute.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key calculations</CardTitle>
            <CardDescription>Graded objectively against the datasets. Use the units shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {def.quantQuestions.map((q) => (
              <div key={q.id} className="space-y-1">
                <Label htmlFor={`q-${q.id}`} className="text-foreground">{q.prompt}</Label>
                <div className="flex items-center gap-2">
                  <Input id={`q-${q.id}`} inputMode="decimal" className="tabular" placeholder={q.hint ?? "—"} aria-invalid={!!errors.quant?.[q.id]} {...register(`quant.${q.id}` as const)} />
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{q.unit}</span>
                </div>
                {errors.quant?.[q.id] && <p className="text-xs text-danger">{errors.quant[q.id]?.message}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Primary drivers</CardTitle>
            <CardDescription>Select the factors you believe are root causes. Not all options are correct.</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="selectedDrivers"
              render={({ field }) => (
                <ul className="space-y-2">
                  {def.diagnosisOptions.map((o) => {
                    const checked = field.value.includes(o.id);
                    return (
                      <li key={o.id} className="flex items-start gap-2">
                        <Checkbox id={`drv-${o.id}`} checked={checked} onCheckedChange={(c) => field.onChange(c ? [...field.value, o.id] : field.value.filter((x) => x !== o.id))} className="mt-0.5" />
                        <label htmlFor={`drv-${o.id}`} className="text-sm leading-snug">{o.label}</label>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

export function SnapshotView({ def, content }: { def: CaseDefinition; content: RecommendationContent }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        {RECOMMENDATION_SECTIONS.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2">{s.label}<Lock className="size-3 text-muted-foreground" /></CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed">{content[s.key] || "—"}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <Card>
          <CardHeader><CardTitle>Key calculations</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {def.quantQuestions.map((q) => (
                <div key={q.id} className="flex justify-between gap-3"><dt className="text-muted-foreground">{q.prompt}</dt><dd className="tabular shrink-0 font-medium">{content.quantAnswers[q.id] ?? "—"} {q.unit}</dd></div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Selected drivers</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {content.selectedDrivers.length ? content.selectedDrivers.map((d) => <Badge key={d}>{def.diagnosisOptions.find((o) => o.id === d)?.label ?? d}</Badge>) : <span className="text-sm text-muted-foreground">None</span>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
