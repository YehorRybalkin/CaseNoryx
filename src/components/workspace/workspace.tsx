"use client";

import { BarChart3, ChevronRight, ClipboardList, Database, FileText, FlaskConical, Lightbulb, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { touchProgressAction } from "@/app/actions";
import { CaseAnalytics } from "@/components/analytics";
import { CoachChat } from "@/components/coach/coach-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CoachMode } from "@/lib/coach";
import { getCase } from "@/lib/cases/registry";
import type { CaseSlug } from "@/lib/cases/types";
import type { RecommendationContent } from "@/lib/recommendation";
import { BriefTab } from "./brief-tab";
import { DataExplorer } from "./data-explorer";
import { HypothesisBoard, type HypothesisView, type NoteView } from "./hypothesis-board";
import { RecommendationForm } from "./recommendation-form";
import { ScenarioSimulator, type SavedScenarioView } from "./scenario-simulator";

export const TABS = [
  { id: "brief", label: "Client Brief", icon: FileText },
  { id: "data", label: "Data Explorer", icon: Database },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "hypotheses", label: "Hypotheses", icon: Lightbulb },
  { id: "scenario", label: "Scenario Simulator", icon: FlaskConical },
  { id: "recommendation", label: "Recommendation", icon: ClipboardList },
] as const;
type TabId = (typeof TABS)[number]["id"];

export interface WorkspaceProps {
  slug: CaseSlug;
  initialTab: string;
  status: "in_progress" | "submitted" | "completed";
  attempts: number;
  hypotheses: HypothesisView[];
  notes: NoteView[];
  scenarios: SavedScenarioView[];
  draft: RecommendationContent;
  draftSavedAt: string | null;
  latestSubmission: { attempt: number; submittedAt: string; content: RecommendationContent } | null;
  pendingEvaluation: boolean;
  coachMode: CoachMode;
}

export function Workspace(props: WorkspaceProps) {
  const def = getCase(props.slug)!;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const valid = (t: string | null): t is TabId => !!t && TABS.some((x) => x.id === t);
  const [tab, setTab] = React.useState<TabId>(valid(props.initialTab) ? props.initialTab : "brief");
  const [hypTitles, setHypTitles] = React.useState(props.hypotheses.map((h) => h.title));

  const paramTab = params.get("tab");
  const [lastParamTab, setLastParamTab] = React.useState(paramTab);
  if (paramTab !== lastParamTab) {
    // Follow external navigation to ?tab=… (state adjusted during render).
    setLastParamTab(paramTab);
    if (valid(paramTab)) setTab(paramTab);
  }

  const changeTab = (t: string) => {
    if (!valid(t)) return;
    setTab(t);
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
    void touchProgressAction(props.slug, t);
  };

  const statusBadge = props.status === "in_progress" ? <Badge variant="accent">{props.attempts > 0 ? `Attempt ${props.attempts + 1}` : "In progress"}</Badge> : props.status === "submitted" ? <Badge variant="warning">Submitted</Badge> : <Badge variant="success">Completed</Badge>;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/cases" className="hover:underline">Case Library</Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{def.title}</span>
      </nav>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{def.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{def.client} · {def.industry}</span>
            <Badge>{def.difficulty}</Badge>
            {statusBadge}
          </div>
        </div>
        <div className="flex gap-2">
          {props.attempts > 0 && <Button asChild variant="outline"><Link href={`/cases/${def.slug}/review`}>Review evaluations</Link></Button>}
          <Dialog>
            <DialogTrigger asChild><Button variant="primary"><MessageSquareText /> Consulting coach</Button></DialogTrigger>
            <DialogContent side="right" title="Consulting coach" description={def.title}>
              <CoachChat caseSlug={def.slug} caseTitle={def.title} defaultMode={props.coachMode} context={{ activeTab: tab, hypotheses: hypTitles }} className="h-[calc(100vh-7rem)]" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList aria-label="Case workspace">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}><t.icon /> {t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="brief"><BriefTab def={def} /></TabsContent>
        <TabsContent value="data"><DataExplorer def={def} /></TabsContent>
        <TabsContent value="analytics"><CaseAnalytics slug={def.slug} /></TabsContent>
        <TabsContent value="hypotheses" forceMount hidden={tab !== "hypotheses"}>
          <HypothesisBoard slug={def.slug} initial={props.hypotheses} notes={props.notes} locked={false} onTitlesChange={setHypTitles} />
        </TabsContent>
        <TabsContent value="scenario"><ScenarioSimulator def={def} saved={props.scenarios} /></TabsContent>
        <TabsContent value="recommendation" forceMount hidden={tab !== "recommendation"}>
          <RecommendationForm def={def} initial={props.draft} status={props.status} attempts={props.attempts} lastSavedAt={props.draftSavedAt} submittedSnapshot={props.latestSubmission} pendingEvaluation={props.pendingEvaluation} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
