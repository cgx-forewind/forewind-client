import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, ChevronsLeft, ChevronsRight, Menu, Search, Sparkles, WifiOff, UserRound, ShieldAlert, ChevronDown, Check, RefreshCw, AlertTriangle, Wrench, LineChart, CircleAlert } from "lucide-react";
import type { Role } from "@/types";
import { useStore, roleHome } from "@/store/useStore";
import { cn, relTime, fmtTimeSec } from "@/lib/utils";
import { go, parse, useHash } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSep, Popover, PopoverTrigger, PopoverContent, Input } from "@/components/ui/misc";
import { NAV, AREA_TITLE } from "./nav";
import { ChatPanel } from "@/components/common/chat";
import { FLEET, TECHNICIANS } from "@/engine/fleet";

const ROLE_META: Record<Role, { label: string; sub: string; area: "senior" | "exec" | "tech"; icon: typeof UserRound }> = {
  senior: { label: "Senior — Operations", sub: "Maintenance manager", area: "senior", icon: Wrench },
  executive: { label: "C-Level — Executive", sub: "Business & finance", area: "exec", icon: LineChart },
  technician: { label: "Technician — Field", sub: "On-site engineer", area: "tech", icon: UserRound },
};
const areaToRole = { senior: "senior", exec: "executive", tech: "technician" } as const;

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-white shadow-card">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 11V3M12 11l-6 7M12 11l6 7" /><circle cx="12" cy="11" r="1.6" fill="currentColor" /></svg>
      </span>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Team CGX</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Predictive Maintenance</p>
        </div>
      )}
    </div>
  );
}

function SidebarNav({ area, collapsed, onNavigate }: { area: "senior" | "exec"; collapsed: boolean; onNavigate?: () => void }) {
  const hash = useHash();
  const approval = useStore((s) => s.approval);
  const sc = useStore((s) => s.scenario);
  const items = NAV[area];
  return (
    <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
      {items.map((it) => {
        const active = hash.startsWith(it.to);
        const dot = (it.badge === "approval" && approval === "pending") || (it.badge === "alerts" && sc.kind === "red" && sc.phase !== "completed");
        return (
          <a key={it.to} href={it.to} onClick={onNavigate} title={collapsed ? it.label : undefined} aria-current={active ? "page" : undefined}
            className={cn("group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors", active ? "bg-primary-50 text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-navy", collapsed && "justify-center")}>
            {active && <span className="absolute -left-2 top-1.5 h-6 w-1 rounded-r bg-primary" />}
            <it.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{it.label}</span>}
            {dot && <span aria-label="needs attention" className={cn("h-2 w-2 rounded-full", it.badge === "alerts" ? "bg-crit" : "bg-warn", collapsed ? "absolute right-1.5 top-1.5" : "ml-auto")} />}
          </a>
        );
      })}
    </nav>
  );
}

export function RoleSwitcher() {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const m = ROLE_META[role];
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button aria-label="Switch demo role" className="flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-xs font-medium hover:bg-slate-50">
          <m.icon className="h-4 w-4 text-primary" aria-hidden />
          <span className="hidden sm:inline">{m.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-64">
        <DropdownLabel>Demo role switcher</DropdownLabel>
        {(Object.keys(ROLE_META) as Role[]).map((r) => {
          const M = ROLE_META[r];
          return (
            <DropdownItem key={r} onSelect={() => { setRole(r); go(roleHome[r]); }}>
              <M.icon className="h-4 w-4 text-primary" />
              <div className="flex-1"><p className="text-sm font-medium leading-tight">{M.label}</p><p className="text-[11px] text-muted">{M.sub}</p></div>
              {r === role && <Check className="h-4 w-4 text-primary" />}
            </DropdownItem>
          );
        })}
        <DropdownSep />
        <p className="px-2.5 py-1.5 text-[11px] leading-snug text-muted">Demo only — this switcher is <b>not</b> authentication or authorisation.</p>
      </DropdownContent>
    </DropdownMenu>
  );
}

export function Notifications() {
  const role = useStore((s) => s.role);
  const notices = useStore((s) => s.notices).filter((n) => n.roles.includes(role));
  const markAll = useStore((s) => s.markAllRead);
  const markRead = useStore((s) => s.markRead);
  const unread = notices.filter((n) => !n.read).length;
  const tone = { info: "bg-accent", success: "bg-ok", warning: "bg-warn", critical: "bg-crit" } as const;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={`Notifications, ${unread} unread`} className="relative grid h-9 w-9 place-items-center rounded-lg border border-line bg-white hover:bg-slate-50">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-bold text-white">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] max-w-[92vw]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">Notification centre</p>
          <button onClick={() => markAll(role)} className="text-xs font-medium text-primary hover:underline">Mark all read</button>
        </div>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {notices.length === 0 && <li className="px-4 py-8 text-center text-xs text-muted">You're all caught up. Alerts from the engine appear here.</li>}
          {notices.map((n) => (
            <li key={n.id}>
              <a href={n.link ?? "#"} onClick={() => markRead(n.id)} className={cn("flex gap-3 px-4 py-3 hover:bg-slate-50", !n.read && "bg-primary-50/40")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone[n.severity])} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted">{relTime(n.ts)}</p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function SearchDialog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const role = useStore((s) => s.role);
  const [q, setQ] = useState("");
  const area = ROLE_META[role].area;
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pages = NAV[area].map((n) => ({ kind: "Page", label: n.label, to: n.to }));
    const turbines = role === "senior" ? FLEET.map((x) => ({ kind: "Turbine", label: `${x.id} · ${x.site}`, to: `#/senior/turbines/${x.id}` })) : [];
    const techs = role === "senior" ? TECHNICIANS.map((x) => ({ kind: "Technician", label: `${x.name} · ${x.base}`, to: "#/senior/technicians" })) : [];
    const all = [...pages, ...turbines, ...techs];
    return (t ? all.filter((x) => x.label.toLowerCase().includes(t)) : all.slice(0, 8)).slice(0, 10);
  }, [q, role, area]);
  const pick = (to: string) => { go(to); setOpen(false); setQ(""); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[18%] max-w-xl -translate-y-0 p-0">
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <DialogDescription className="sr-only">Search pages, turbines and technicians</DialogDescription>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && results[0] && pick(results[0].to)} placeholder="Search turbines, technicians, pages…" aria-label="Search" className="h-12 flex-1 bg-transparent text-sm outline-none" />
          <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">No results for “{q}”.</li>}
          {results.map((r) => (
            <li key={r.kind + r.label}>
              <button onClick={() => pick(r.to)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 focus-visible:bg-slate-100">
                <span>{r.label}</span><Badge variant="outline">{r.kind}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function SyncStatus() {
  const lastSync = useStore((s) => s.lastSync);
  const offline = useStore((s) => s.offline);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  return (
    <div className="hidden items-center gap-3 text-xs text-muted lg:flex">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium", offline ? "bg-warn-soft text-warn-ink" : "bg-ok-soft text-ok-ink")}>
        <span className="relative flex h-2 w-2"><span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulseRing", offline ? "bg-warn" : "bg-ok")} /><span className={cn("relative h-2 w-2 rounded-full", offline ? "bg-warn" : "bg-ok")} /></span>
        {offline ? "Monitoring paused" : "Live monitoring"}
      </span>
      <span className="inline-flex items-center gap-1" title={fmtTimeSec(lastSync)}><RefreshCw className="h-3 w-3" /> Synced {relTime(lastSync)}</span>
    </div>
  );
}

export function ContextBanner() {
  const s = useStore();
  const hash = useHash();
  const items: { tone: "crit" | "warn" | "info"; icon: ReactNode; text: string; to?: string; cta?: string }[] = [];
  const sc = s.scenario;
  if (s.offline) items.push({ tone: "warn", icon: <WifiOff className="h-4 w-4" />, text: "Offline — showing last known data. Last sync " + relTime(s.lastSync) + ". Predictions may be stale." });
  if (sc.kind === "red" && sc.phase !== "completed") {
    if (s.role === "senior") items.push({ tone: "crit", icon: <ShieldAlert className="h-4 w-4" />, text: `RED ALERT ${sc.turbineId}: ${sc.phase === "escalated" ? "no technician accepted — automated dispatch stopped, manual control required" : "emergency protocol active — dispatch does not authorise unsafe work"}.`, to: sc.phase === "escalated" ? "#/senior/technicians" : "#/senior/engine", cta: "Live incident" });
    if (s.role === "executive") items.push({ tone: "crit", icon: <ShieldAlert className="h-4 w-4" />, text: `Critical risk on ${sc.turbineId}: response under way. Potential exposure up to €236k if unplanned.`, to: "#/exec/dashboard", cta: "Business impact" });
  }
  if (s.role === "senior" && s.approval === "pending") items.push({ tone: "warn", icon: <AlertTriangle className="h-4 w-4" />, text: `Approval required: maintenance plan for ${sc.turbineId}.`, to: "#/senior/optimization", cta: "Review plan" });
  if (s.role === "technician" && s.assignment?.status === "offered") items.push({ tone: s.assignment.kind === "emergency" ? "crit" : "info", icon: <CircleAlert className="h-4 w-4" />, text: `New ${s.assignment.kind} assignment on ${s.assignment.turbineId}.`, to: "#/tech/task", cta: "Open task" });
  const tones = { crit: "bg-crit text-white", warn: "bg-warn-soft text-warn-ink border-b border-warn/30", info: "bg-primary-50 text-primary border-b border-primary/20" };
  if (!items.length) return null;
  return (
    <div className="no-print" role="region" aria-label="Alerts">
      {items.map((b, i) => (
        <div key={i} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm font-medium animate-fadeIn", tones[b.tone])}>
          {b.icon}<span className="min-w-0 flex-1">{b.text}</span>
          {b.to && !hash.startsWith(b.to) && <a href={b.to} className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-semibold underline-offset-2 hover:underline">{b.cta}</a>}
        </div>
      ))}
    </div>
  );
}

export function AssistantDrawer() {
  const open = useStore((s) => s.assistantOpen);
  const toggle = useStore((s) => s.toggleAssistant);
  const role = useStore((s) => s.role);
  return (
    <Dialog open={open} onOpenChange={toggle}>
      <DialogContent side="right" aria-describedby={undefined}>
        <DialogTitle className="sr-only">AI assistant</DialogTitle>
        <ChatPanel role={role} compact />
      </DialogContent>
    </Dialog>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hash = useHash();
  const route = parse(hash);
  const area = route.area === "exec" ? "exec" : "senior";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState(false);
  const toggleAssistant = useStore((s) => s.toggleAssistant);
  const role = useStore((s) => s.role);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-pop">Skip to content</a>
      <aside className={cn("no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white transition-[width] duration-200 md:flex", collapsed ? "w-[68px]" : "w-64")}>
        <div className={cn("flex h-16 items-center border-b border-line px-4", collapsed && "justify-center px-0")}><Logo collapsed={collapsed} /></div>
        <SidebarNav area={area} collapsed={collapsed} />
        <div className="border-t border-line p-2">
          {!collapsed && <p className="px-2 pb-2 text-[10px] leading-snug text-muted">{AREA_TITLE[area]}<br />Simulated data — not verified SKF data</p>}
          <button onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium text-muted hover:bg-slate-100">
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>
      <Dialog open={mobileNav} onOpenChange={setMobileNav}>
        <DialogContent side="left" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <div className="flex h-16 items-center border-b border-line px-4"><Logo /></div>
          <SidebarNav area={area} collapsed={false} onNavigate={() => setMobileNav(false)} />
        </DialogContent>
      </Dialog>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-5">
          <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 md:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu className="h-5 w-5" /></button>
          <button onClick={() => setSearch(true)} aria-label="Search (press /)" className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted transition hover:border-slate-300 sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0" /><span className="truncate">Search turbines, technicians…</span><kbd className="ml-auto hidden rounded border border-line bg-white px-1.5 text-[10px] sm:block">/</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <SyncStatus />
            <Button variant="ai" size="sm" className="hidden sm:inline-flex" onClick={() => toggleAssistant(true)}><Sparkles className="h-4 w-4" /> Ask AI</Button>
            <Notifications />
            <RoleSwitcher />
            <div className="hidden h-9 w-9 place-items-center rounded-full bg-navy text-xs font-semibold text-white sm:grid" title={`Demo user — ${role}`} aria-label="User profile (demo)">{role === "senior" ? "MS" : role === "executive" ? "CX" : "OH"}</div>
          </div>
        </header>
        <ContextBanner />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">{children}</main>
      </div>
      <button onClick={() => toggleAssistant(true)} aria-label="Open AI assistant" className="no-print fixed bottom-4 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-ai text-white shadow-pop transition hover:scale-105 sm:hidden"><Sparkles className="h-5 w-5" /></button>
      <SearchDialog open={search} setOpen={setSearch} />
    </div>
  );
}

export function TechShell({ children }: { children: ReactNode }) {
  const hash = useHash();
  const toggleAssistant = useStore((s) => s.toggleAssistant);
  const assignment = useStore((s) => s.assignment);
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col bg-surface shadow-[0_0_0_1px_#E2E8F0]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur">
        <Logo collapsed />
        <div className="leading-tight"><p className="text-sm font-semibold">Field Operations</p><p className="text-[10px] text-muted">Team CGX</p></div>
        <div className="ml-auto flex items-center gap-2"><Notifications /><RoleSwitcher /></div>
      </header>
      <ContextBanner />
      <main id="main" tabIndex={-1} className="flex-1 pb-24 focus:outline-none">{children}</main>
      <nav aria-label="Primary" className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-xl -translate-x-1/2 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        {NAV.tech.map((it) => {
          const active = hash.startsWith(it.to);
          return (
            <a key={it.to} href={it.to} aria-current={active ? "page" : undefined} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted")}>
              <it.icon className="h-5 w-5" aria-hidden />{it.label}
              {it.label === "Task" && assignment && assignment.status !== "completed" && <span className="absolute right-[32%] top-2 h-2 w-2 rounded-full bg-crit" />}
            </a>
          );
        })}
      </nav>
      <button onClick={() => toggleAssistant(true)} aria-label="Open AI assistant" className="fixed bottom-20 right-3 z-40 grid h-11 w-11 place-items-center rounded-full bg-ai text-white shadow-pop"><Sparkles className="h-5 w-5" /></button>
    </div>
  );
}

export { areaToRole };
