"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { resetProgressAction, updateSettingsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/slider";
import { COACH_MODES, COACH_MODE_LABELS } from "@/lib/coach";

const Schema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name").max(60, "Max. 60 characters"),
  theme: z.enum(["system", "light", "dark"]),
  coachMode: z.enum(COACH_MODES),
  aiCoachEnabled: z.boolean(),
  aiEvaluationEnabled: z.boolean(),
});
type Values = z.infer<typeof Schema>;

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { register, control, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: initial });
  const [confirm, setConfirm] = React.useState("");

  const onSubmit = async (v: Values) => {
    const res = await updateSettingsAction(v);
    if (!res.ok) return toast.error(res.error);
    setTheme(v.theme);
    reset(v);
    toast.success("Settings saved");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Profile & appearance</CardTitle><CardDescription>Local single-user profile.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" aria-invalid={!!errors.displayName} {...register("displayName")} />
              <FieldError message={errors.displayName?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="theme">Theme</Label>
              <Select id="theme" {...register("theme")}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>AI features</CardTitle><CardDescription>Optional. Requires ANTHROPIC_API_KEY on the server.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 md:max-w-sm">
              <Label htmlFor="coachMode">Default coaching mode</Label>
              <Select id="coachMode" {...register("coachMode")}>{COACH_MODES.map((m) => <option key={m} value={m}>{COACH_MODE_LABELS[m].label}</option>)}</Select>
            </div>
            <Controller control={control} name="aiCoachEnabled" render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div><Label htmlFor="aiCoach" className="text-sm text-foreground">AI consulting coach</Label><p className="text-xs text-muted-foreground">When off (or no key), the coach uses offline case-specific hints.</p></div>
                <Switch id="aiCoach" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )} />
            <Controller control={control} name="aiEvaluationEnabled" render={({ field }) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div><Label htmlFor="aiEval" className="text-sm text-foreground">AI qualitative evaluation</Label><p className="text-xs text-muted-foreground">Adds AI scoring for structuring, recommendations and communication. Objective grading always runs.</p></div>
                <Switch id="aiEval" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )} />
          </CardContent>
        </Card>
        <div className="flex justify-end"><Button type="submit" disabled={isSubmitting || !isDirty}>{isSubmitting ? "Saving…" : "Save settings"}</Button></div>
      </form>

      <Card className="border-danger/40">
        <CardHeader><CardTitle className="text-danger">Danger zone</CardTitle><CardDescription>Permanently delete all hypotheses, notes, scenarios, drafts, submissions, evaluations and history. Settings are kept.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="reset-confirm">Type RESET to enable</Label>
            <Input id="reset-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="sm:w-48" />
          </div>
          <ConfirmDialog
            trigger={<Button variant="destructive" disabled={confirm !== "RESET"}>Reset all progress</Button>}
            title="Delete all progress?"
            description="This cannot be undone. All of your case work and evaluation history will be deleted from the local database."
            confirmLabel="Delete everything"
            destructive
            onConfirm={async () => {
              const r = await resetProgressAction(confirm);
              if (r.ok) { toast.success("All progress deleted"); setConfirm(""); router.refresh(); } else toast.error(r.error);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
