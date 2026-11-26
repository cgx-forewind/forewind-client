import { useMemo } from "react";
import { Activity, AlertOctagon, CalendarClock, Gauge, Wind, Wrench, ShieldCheck, TriangleAlert, Radio, Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import { go } from "@/lib/router";
import { KpiCard, PageHeader, RiskBadge, SimTag } from "@/components/common/bits";
import { WindFarmMap } from "@/components/common/maps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BASE_ACTIVITY } from "@/engine/history";
import { fmtTime, pct, relTime, num } from "@/lib/utils";
import { SITE_NAME, TECHNICIANS } from "@/engine/fleet";
import { Button } from "@/components/ui/button";

export default function SeniorDashboard() {
  const fleet = useStore((s) => s.fleet);
  const events = useStore((s) => s.events);
  const jobs = useStore((s) => s.jobs);
  const approval = useStore((s) => s.approval);
  const assignment = useStore((s) => s.assignment);
  const windows = useStore((s) => s.windows);
  const selected = useStore((s) => s.selectedWindowId);
  const sc = useStore((s) => s.scenario);

  const k = useMemo(() => {
    const total = fleet.length;
    const operational = fleet.filter((t) => t.status === "operational").length;
    const atRisk = fleet.filter((t) => t.risk !== "green" && t.status !== "maintenance").length;
    const critical = fleet.filter((t) => t.risk === "red" && t.status !== "maintenance").length;
    return { total, operational, atRisk, critical, availability: operational / total };
  }, [fleet]);
  const activeTasks = (assignment && assignment.status !== "completed" ? 1 : 0) + fleet.filter((t) => t.status === "maintenance" && t.id !== assignment?.turbineId).length;
  const scheduled = jobs.filter((j) => j.status === "open" && j.kind === "planned").length + (approval === "pending" ? 0 : 0);
  const selWin = windows.find((w) => w.id === selected);
  const decisions = events.filter((e) => e.actor === "engine").slice(-5).reverse();
  const live = useMemo(() => {
    const base = BASE_ACTIVITY.map((b) => ({ id: b.text, ts: Date.now() - b.m * 60000, text: b.text, tone: "info" as const }));
    const ev = events.map((e) => ({ id: e.id, ts: e.ts, text: `${e.turbineId ? e.turbineId + " · " : ""}${e.title}`, tone: e.status === "failed" ? ("crit" as const) : e.status === "warning" ? ("warn" as const) : ("info" as const) }));
    return [...ev, ...base].sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [events]);
  const watch = [...fleet].filter((t) => t.risk !== "green" || t.riskScore > 0.22).sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

  return (
    <div className="page">
      <PageHeader title="Operations Centre" subtitle={<>{SITE_NAME} · {k.total} turbines <SimTag className="ml-1" /></>} actions={approval === "pending" ? <Button size="sm" onClick={() => go("#/senior/optimization")}><CalendarClock className="h-4 w-4" /> Review maintenance plan</Button> : null} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total turbines" value={k.total} icon={<Wind className="h-4 w-4" />} hint="3 ridges" onClick={() => go("#/senior/turbines")} />
        <KpiCard label="Operational" value={k.operational} icon={<ShieldCheck className="h-4 w-4" />} tone="ok" hint={`${k.total - k.operational} offline / in service`} />
        <KpiCard label="At risk" value={k.atRisk} icon={<TriangleAlert className="h-4 w-4" />} tone="warn" hint="Yellow or red" onClick={() => go("#/senior/predictive")} />
        <KpiCard label="Critical alerts" value={k.critical} icon={<AlertOctagon className="h-4 w-4" />} tone="crit" hint={k.critical ? "Emergency protocol" : "None active"} onClick={() => go("#/senior/engine")} />
        <KpiCard label="Active tasks" value={activeTasks} icon={<Wrench className="h-4 w-4" />} tone="primary" hint="In progress" onClick={() => go("#/senior/technicians")} />
        <KpiCard label="Scheduled" value={scheduled + (approval === "pending" ? 1 : 0)} icon={<CalendarClock className="h-4 w-4" />} tone="primary" hint={approval === "pending" ? "Awaiting approval" : "Approved plans"} onClick={() => go("#/senior/optimization")} />
        <KpiCard label="Fleet availability" value={pct(k.availability, 1)} icon={<Gauge className="h-4 w-4" />} tone="ok" hint="Current" sim />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><div><CardTitle>Wind farm overview</CardTitle><CardDescription>Click a turbine for detailed monitoring</CardDescription></div>
            <Badge variant="primary"><Radio className="h-3 w-3" /> Live</Badge></CardHeader>
          <CardContent><WindFarmMap fleet={fleet} techs={TECHNICIANS} selectedId={sc.turbineId ?? undefined} onSelect={(id) => go(`#/senior/turbines/${id}`)} height={360}
            route={assignment ? { techId: assignment.techId, turbineId: assignment.turbineId } : null} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Watch-list</CardTitle><CardDescription>Highest failure risk right now</CardDescription></div></CardHeader>
          <CardContent>
            <ul className="divide-y divide-line">
              {watch.map((t) => (
                <li key={t.id}>
                  <button onClick={() => go(`#/senior/turbines/${t.id}`)} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-slate-50">
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t.id}</p><p className="text-xs text-muted">{t.rulDays ? `RUL ${num(t.rulDays)} d` : "No action needed"} · {pct(t.riskScore)} risk</p></div>
                    <RiskBadge risk={t.risk} />
                  </button>
                </li>
              ))}
            </ul>
            {selWin && approval !== "none" && (
              <div className="mt-3 rounded-lg bg-primary-50 p-3 text-xs"><b className="text-primary">Proposed window:</b> {fmtTime(selWin.start)}–{fmtTime(selWin.end)}, {approval === "approved" ? "approved" : "awaiting approval"}.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-ai" /> Recent AI decisions</CardTitle><CardDescription>Unified engine · most recent first</CardDescription></div>
            <Button variant="ghost" size="sm" onClick={() => go("#/senior/engine")}>All activity</Button></CardHeader>
          <CardContent>
            {decisions.length === 0 ? <p className="py-6 text-center text-sm text-muted">No engine decisions yet. Use Demo mode to start a scenario.</p> : (
              <ul className="space-y-3">{decisions.map((e) => (
                <li key={e.id} className="flex gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ai-soft text-[10px] font-bold text-ai-ink">{e.step}</span>
                  <div className="min-w-0"><p className="text-sm font-medium leading-tight">{e.title}</p><p className="line-clamp-2 text-xs text-muted">{e.explanation}</p></div></li>
              ))}</ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-primary" /> Live operational activity</CardTitle><CardDescription>Streaming from the unified engine</CardDescription></div></CardHeader>
          <CardContent>
            <ul className="space-y-2.5">{live.map((l) => (
              <li key={l.id} className="flex items-start gap-3 text-sm"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.tone === "crit" ? "bg-crit" : l.tone === "warn" ? "bg-warn" : "bg-accent"}`} /><span className="min-w-0 flex-1">{l.text}</span><span className="shrink-0 text-xs text-muted">{relTime(l.ts)}</span></li>
            ))}</ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
