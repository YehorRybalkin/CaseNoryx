import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Callout, PageHeader } from "@/components/ui/misc";
import { aiConfigured, env } from "@/server/env";
import { getSettings } from "@/server/services";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  const configured = aiConfigured();
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Settings" description="Preferences are stored in your local SQLite database." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><SettingsForm initial={settings} /></div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>AI configuration</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span>Anthropic API key</span>{configured ? <Badge variant="success">Configured</Badge> : <Badge variant="warning">Not configured</Badge>}</div>
              <div className="flex items-center justify-between"><span>Model</span><span className="font-mono text-xs">{env().ANTHROPIC_MODEL}</span></div>
              <p className="text-xs text-muted-foreground">The key is read from the server environment only and is never sent to the browser. Set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> and restart to enable AI features.</p>
            </CardContent>
          </Card>
          <Callout title="Local single-user mode">CaseNoryx runs as a single local user without authentication. It is not designed or secured for multi-user or public deployment.</Callout>
        </div>
      </div>
    </div>
  );
}
