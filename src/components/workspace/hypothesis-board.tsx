"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lightbulb, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createHypothesisAction, createNoteAction, deleteHypothesisAction, deleteNoteAction, updateHypothesisAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import { fmtDateTime } from "@/lib/format";

export interface HypothesisView {
  id: string;
  title: string;
  description: string;
  supporting: string;
  contradicting: string;
  confidence: number;
  status: "untested" | "supported" | "contradicted" | "inconclusive";
  updatedAt: string;
}
export interface NoteView { id: string; content: string; createdAt: string }

const FormSchema = z.object({
  title: z.string().trim().min(3, "Give the hypothesis a short title (min. 3 characters)").max(160),
  description: z.string().max(2000),
  supporting: z.string().max(4000),
  contradicting: z.string().max(4000),
  confidence: z.number().int().min(0).max(100),
  status: z.enum(["untested", "supported", "contradicted", "inconclusive"]),
});
type FormValues = z.infer<typeof FormSchema>;

export const STATUS_META: Record<HypothesisView["status"], { label: string; variant: "default" | "success" | "danger" | "warning" }> = {
  untested: { label: "Untested", variant: "default" },
  supported: { label: "Supported", variant: "success" },
  contradicted: { label: "Contradicted", variant: "danger" },
  inconclusive: { label: "Inconclusive", variant: "warning" },
};

export function HypothesisBoard({ slug, initial, notes: initialNotes, locked, onTitlesChange }: { slug: string; initial: HypothesisView[]; notes: NoteView[]; locked: boolean; onTitlesChange?: (titles: string[]) => void }) {
  const [items, setItems] = React.useState(initial);
  React.useEffect(() => onTitlesChange?.(items.map((h) => h.title)), [items, onTitlesChange]);
  const [notes, setNotes] = React.useState(initialNotes);
  const [editing, setEditing] = React.useState<HypothesisView | "new" | null>(null);
  const [filter, setFilter] = React.useState<"all" | HypothesisView["status"]>("all");
  const [note, setNote] = React.useState("");
  const [savingNote, setSavingNote] = React.useState(false);

  const shown = items.filter((h) => filter === "all" || h.status === filter);
  const counts = Object.fromEntries((Object.keys(STATUS_META) as HypothesisView["status"][]).map((s) => [s, items.filter((h) => h.status === s).length]));

  async function remove(h: HypothesisView) {
    const res = await deleteHypothesisAction(slug, h.id);
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.id !== h.id));
      toast.success("Hypothesis deleted");
    } else toast.error(res.error);
  }

  async function addNote() {
    setSavingNote(true);
    const res = await createNoteAction(slug, note);
    setSavingNote(false);
    if (res.ok) {
      setNotes((n) => [{ id: res.data.id, content: res.data.content, createdAt: new Date(res.data.createdAt).toISOString() }, ...n]);
      setNote("");
      toast.success("Note saved");
    } else toast.error(res.error);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Lightbulb className="size-4 text-accent" /> Hypothesis board</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">State falsifiable hypotheses, then record supporting and contradicting evidence from the data.</p>
            </div>
            <div className="flex gap-2">
              <Select aria-label="Filter hypotheses" className="w-40" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="all">All ({items.length})</option>
                {(Object.keys(STATUS_META) as HypothesisView["status"][]).map((s) => <option key={s} value={s}>{STATUS_META[s].label} ({counts[s]})</option>)}
              </Select>
              <Button onClick={() => setEditing("new")} disabled={locked}><Plus /> New hypothesis</Button>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <EmptyState icon={<Lightbulb />} title="No hypotheses yet" description="Good consultants start with a hypothesis. Example: “Gross margin fell because the sales mix shifted toward low-margin categories.”" action={<Button onClick={() => setEditing("new")} disabled={locked}><Plus /> Add your first hypothesis</Button>} />
            ) : shown.length === 0 ? (
              <EmptyState title="No hypotheses with this status" />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2" data-testid="hypothesis-list">
                {shown.map((h) => (
                  <li key={h.id} className="flex flex-col rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold">{h.title}</h4>
                      <Badge variant={STATUS_META[h.status].variant}>{STATUS_META[h.status].label}</Badge>
                    </div>
                    {h.description && <p className="mt-1 text-xs text-muted-foreground">{h.description}</p>}
                    <dl className="mt-3 space-y-2 text-xs">
                      <div><dt className="font-medium text-success">Supporting evidence</dt><dd className="whitespace-pre-wrap text-muted-foreground">{h.supporting || "—"}</dd></div>
                      <div><dt className="font-medium text-danger">Contradicting evidence</dt><dd className="whitespace-pre-wrap text-muted-foreground">{h.contradicting || "—"}</dd></div>
                    </dl>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="text-xs text-muted-foreground">Confidence <span className="tabular font-medium text-foreground">{h.confidence}%</span></span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label={`Edit ${h.title}`} onClick={() => setEditing(h)} disabled={locked}><Pencil /></Button>
                        <ConfirmDialog
                          trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${h.title}`} disabled={locked}><Trash2 /></Button>}
                          title="Delete hypothesis?"
                          description={<>“{h.title}” and its evidence will be permanently deleted.</>}
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => remove(h)}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><NotebookPen className="size-4 text-accent" /> Investigation notes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea aria-label="New note" rows={3} placeholder="Record an observation, a number, a question…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
          <Button size="sm" onClick={addNote} disabled={!note.trim() || savingNote}>{savingNote ? "Saving…" : "Save note"}</Button>
          {notes.length === 0 ? <p className="text-xs text-muted-foreground">No notes yet.</p> : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="group rounded-lg border border-border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fmtDateTime(n.createdAt)}</span>
                    <ConfirmDialog
                      trigger={<button className="text-danger hover:underline" aria-label="Delete note">Delete</button>}
                      title="Delete note?"
                      description="This note will be permanently deleted."
                      confirmLabel="Delete"
                      destructive
                      onConfirm={async () => {
                        const r = await deleteNoteAction(slug, n.id);
                        if (r.ok) { setNotes((xs) => xs.filter((x) => x.id !== n.id)); toast.success("Note deleted"); } else toast.error(r.error);
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <DialogContent title={editing === "new" ? "New hypothesis" : "Edit hypothesis"} description="Hypotheses are saved to your local database.">
            <HypothesisForm
              initial={editing === "new" ? undefined : editing}
              onCancel={() => setEditing(null)}
              onSubmit={async (values) => {
                const res = editing === "new" ? await createHypothesisAction(slug, values) : await updateHypothesisAction(slug, editing.id, values);
                if (!res.ok) { toast.error(res.error); return; }
                const v: HypothesisView = { ...res.data, status: res.data.status as HypothesisView["status"], updatedAt: new Date(res.data.updatedAt).toISOString() };
                setItems((xs) => (editing === "new" ? [...xs, v] : xs.map((x) => (x.id === v.id ? v : x))));
                toast.success(editing === "new" ? "Hypothesis created" : "Hypothesis updated");
                setEditing(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function HypothesisForm({ initial, onSubmit, onCancel }: { initial?: HypothesisView; onSubmit: (v: FormValues) => Promise<void>; onCancel: () => void }) {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? { title: initial.title, description: initial.description, supporting: initial.supporting, contradicting: initial.contradicting, confidence: initial.confidence, status: initial.status }
      : { title: "", description: "", supporting: "", contradicting: "", confidence: 50, status: "untested" },
  });
  const confidence = watch("confidence");
  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-1">
        <Label htmlFor="h-title">Title</Label>
        <Input id="h-title" aria-invalid={!!errors.title} {...register("title")} placeholder="e.g. Electronics discounting compressed margins" />
        <FieldError message={errors.title?.message} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="h-desc">Description</Label>
        <Textarea id="h-desc" rows={2} {...register("description")} placeholder="What do you believe and why?" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="h-sup">Supporting evidence</Label>
          <Textarea id="h-sup" rows={4} {...register("supporting")} placeholder="Numbers and observations that support it" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="h-con">Contradicting evidence</Label>
          <Textarea id="h-con" rows={4} {...register("contradicting")} placeholder="Numbers and observations against it" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="h-status">Status</Label>
          <Select id="h-status" {...register("status")}>
            {(Object.keys(STATUS_META) as HypothesisView["status"][]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Confidence: <span className="tabular text-foreground">{confidence}%</span></Label>
          <Slider aria-label="Confidence" min={0} max={100} step={5} value={[confidence]} onValueChange={([v]) => setValue("confidence", v, { shouldDirty: true })} className="mt-2" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save hypothesis"}</Button>
      </div>
    </form>
  );
}
