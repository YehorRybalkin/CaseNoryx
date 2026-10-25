"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-border bg-surface p-6 text-center">
      <AlertTriangle className="mx-auto size-6 text-danger" />
      <h1 className="mt-3 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 text-sm text-muted-foreground">The page could not be loaded. Your saved work is not affected. If this persists, check that the database is initialised (<code>npm run setup</code>).</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
