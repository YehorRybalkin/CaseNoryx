"use client";

import { ArrowRight, Clock, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import type { CaseSummary } from "@/lib/cases/types";

export interface LibraryItem extends CaseSummary {
  status: "not_started" | "in_progress" | "submitted" | "completed";
  attempts: number;
  bestScore: number | null;
}

const STATUS: Record<LibraryItem["status"], { label: string; variant: "default" | "accent" | "warning" | "success" }> = {
  not_started: { label: "Not started", variant: "default" },
  in_progress: { label: "In progress", variant: "accent" },
  submitted: { label: "Awaiting evaluation", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
};

export function CaseLibrary({ items }: { items: LibraryItem[] }) {
  const [q, setQ] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const filtered = items.filter(
    (c) =>
      (difficulty === "all" || c.difficulty === difficulty) &&
      (status === "all" || c.status === status) &&
      (q === "" || `${c.title} ${c.client} ${c.industry} ${c.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input aria-label="Search cases" placeholder="Search by industry, skill or client…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Filter by difficulty" className="sm:w-44" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="all">All difficulties</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </Select>
        <Select aria-label="Filter by status" className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No cases match your filters" action={<Button variant="outline" onClick={() => { setQ(""); setDifficulty("all"); setStatus("all"); }}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c, i) => (
            <Card key={c.slug} className="flex flex-col p-5" data-testid={`case-card-${c.slug}`}>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Case {i + 1} · {c.industry}</span>
                <Badge variant={STATUS[c.status].variant}>{STATUS[c.status].label}</Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">{c.title}</h2>
              <p className="text-sm text-muted-foreground">{c.client}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed">{c.summary}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.tags.slice(0, 5).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant={c.difficulty === "Beginner" ? "success" : c.difficulty === "Intermediate" ? "accent" : "warning"}>{c.difficulty}</Badge>
                  <span className="flex items-center gap-1"><Clock className="size-3.5" />~{c.estimatedMinutes} min</span>
                  {c.bestScore !== null && <span>Best {c.bestScore.toFixed(0)}%</span>}
                </div>
                <div className="flex gap-2">
                  {c.attempts > 0 && <Button asChild variant="ghost" size="sm"><Link href={`/cases/${c.slug}/review`}>Review</Link></Button>}
                  <Button asChild size="sm"><Link href={`/cases/${c.slug}`}>{c.status === "not_started" ? "Start" : "Open"} <ArrowRight /></Link></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
