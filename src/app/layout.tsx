import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/layout/providers";
import { CASES, getCase } from "@/lib/cases/registry";
import { getSettings, listProgress } from "@/server/services";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CaseNoryx", template: "%s · CaseNoryx" },
  description: "Think like a consultant. Analyze like an expert. Interactive business cases with analytics, simulation and evaluation.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, progress] = await Promise.all([getSettings(), listProgress()]);
  const active = progress.filter((p) => p.status === "in_progress").sort((a, b) => +b.lastActivityAt - +a.lastActivityAt)[0];
  const activeDef = active ? getCase(active.caseId) : null;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers defaultTheme={settings.theme}>
          <AppShell caseTitles={Object.fromEntries(CASES.map((c) => [c.slug, c.title]))} displayName={settings.displayName} activeCase={activeDef ? { slug: activeDef.slug, title: activeDef.title } : null}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
