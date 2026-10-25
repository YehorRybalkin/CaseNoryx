"use client";
import { Slider as S, Switch as Sw, Checkbox as Cb } from "radix-ui";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Slider({ className, ...p }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root className={cn("relative flex h-5 w-full touch-none select-none items-center", className)} {...p}>
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-2 border border-border">
        <S.Range className="absolute h-full bg-accent" />
      </S.Track>
      <S.Thumb aria-label={p["aria-label"]} className="block size-4 rounded-full border-2 border-accent bg-surface shadow focus-visible:outline-2 focus-visible:outline-ring" />
    </S.Root>
  );
}

export function Switch({ className, ...p }: React.ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border bg-surface-2 transition-colors data-[state=checked]:bg-accent", className)} {...p}>
      <Sw.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
    </Sw.Root>
  );
}

export function Checkbox({ className, ...p }: React.ComponentProps<typeof Cb.Root>) {
  return (
    <Cb.Root className={cn("flex size-4 shrink-0 items-center justify-center rounded border border-border bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent", className)} {...p}>
      <Cb.Indicator><Check className="size-3 text-white" /></Cb.Indicator>
    </Cb.Root>
  );
}
