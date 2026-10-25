"use client";
import { AlertDialog as AD, Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, side, ...p }: React.ComponentProps<typeof D.Content> & { title: string; description?: string; side?: "right" }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col border border-border bg-surface shadow-xl focus:outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-md"
            : "left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl",
          className,
        )}
        {...p}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-xs text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close asChild>
            <Button variant="ghost" size="icon" aria-label="Close"><X /></Button>
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/** Confirmation for destructive or irreversible actions. */
export function ConfirmDialog({
  trigger, title, description, confirmLabel = "Confirm", destructive, onConfirm, open, onOpenChange,
}: {
  trigger?: React.ReactNode; title: string; description: React.ReactNode; confirmLabel?: string; destructive?: boolean;
  onConfirm: () => void; open?: boolean; onOpenChange?: (o: boolean) => void;
}) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <AD.Trigger asChild>{trigger}</AD.Trigger> : null}
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <AD.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-xl">
          <AD.Title className="text-base font-semibold">{title}</AD.Title>
          <AD.Description asChild><div className="mt-2 text-sm text-muted-foreground">{description}</div></AD.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AD.Cancel asChild><Button variant="outline">Cancel</Button></AD.Cancel>
            <AD.Action asChild>
              <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>{confirmLabel}</Button>
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
