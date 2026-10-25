"use client";

import { BarChart3, BookOpen, Briefcase, Calculator, ChevronsLeft, ChevronsRight, FlaskConical, LayoutDashboard, Menu, MessageSquareText, Moon, Settings, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ShellProps {
  children: React.ReactNode;
  displayName: string;
  activeCase: { slug: string; title: string } | null;
  caseTitles: Record<string, string>;
}

export function AppShell({ children, displayName, activeCase: storedActive, caseTitles }: ShellProps) {
  const pathname = usePathname();
  const openSlug = pathname.match(/^\/cases\/([^/]+)/)?.[1];
  const activeCase = openSlug && caseTitles[openSlug] ? { slug: openSlug, title: caseTitles[openSlug] } : storedActive;
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    // Close the mobile drawer whenever the route changes (state adjusted during render).
    setLastPath(pathname);
    setMobileOpen(false);
  }
  React.useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem("cnx.sidebar") === "collapsed";
    } catch {
      /* storage unavailable */
    }
    // One-time sync from browser storage after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("cnx.sidebar", c ? "expanded" : "collapsed");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
    { href: "/cases", label: "Case Library", icon: BookOpen, match: (p: string) => p === "/cases" },
    { href: activeCase ? `/cases/${activeCase.slug}` : "/cases", label: "Active Case", icon: Briefcase, match: (p: string) => p.startsWith("/cases/"), hint: activeCase?.title ?? "No case in progress" },
    { href: "/analytics", label: "Analytics Lab", icon: Calculator, match: (p: string) => p.startsWith("/analytics") },
    { href: "/simulator", label: "Scenario Simulator", icon: FlaskConical, match: (p: string) => p.startsWith("/simulator") },
    { href: "/coach", label: "AI Consulting Coach", icon: MessageSquareText, match: (p: string) => p.startsWith("/coach") },
    { href: "/performance", label: "Performance Center", icon: BarChart3, match: (p: string) => p.startsWith("/performance") },
    { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
  ];

  const sidebar = (mobile: boolean) => (
    <nav aria-label="Main navigation" className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2 px-4", collapsed && !mobile && "justify-center px-0")}>
        <div className="flex size-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">CN</div>
        {(!collapsed || mobile) && (
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">CaseNoryx</div>
            <div className="text-[10px] text-sidebar-foreground/70">Think like a consultant</div>
          </div>
        )}
        {mobile && (
          <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground hover:bg-sidebar-active" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></Button>
        )}
      </div>
      <ul className="mt-2 flex flex-1 flex-col gap-0.5 px-2">
        {nav.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={collapsed && !mobile ? item.label : item.hint}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-active hover:text-white",
                  active && "bg-sidebar-active text-white",
                  collapsed && !mobile && "justify-center px-0",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-accent")} />
                {(!collapsed || mobile) && (
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {item.label === "Active Case" && <span className="block truncate text-[10px] text-sidebar-foreground/60">{item.hint}</span>}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {!mobile && (
        <div className="p-2">
          <button onClick={toggleCollapsed} className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-active" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
          </button>
        </div>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 bg-sidebar transition-[width] md:block", collapsed ? "w-16" : "w-60")}>{sidebar(false)}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar">{sidebar(true)}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
          <div className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">Local workspace · </span>
            <span className="font-medium text-foreground">{displayName}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button variant="ghost" size="icon" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
