import { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import { useStore } from "@/store/useStore";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { CardSkeleton, ErrorState, KpiCard, PageHeader, SimTag } from "@/components/common/bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { eur, num } from "@/lib/utils";
import { tokens } from "@/lib/tokens";
import { EMERGENCY_JOB_COST, PLANNED_JOB_COST, REACTIVE_FAILURE_COST } from "@/engine/finance";

export default function Financial() {
  const jobs = useStore((s) => s.jobs);
  const f = useAsync(() => api.getFinance(jobs), [jobs]);
  const [view, setView] = useState("monthly");
  const m = f.data?.monthly;
  const rows = useMemo(() => {
    if (!m) return [];
    let cum = 0;
    return m.map((r) => {
      cum += r.avoided;
      const real = r.kind === "realized";
      return { month: r.month, plannedR: real ? r.planned : null, plannedP: real ? null : r.planned, reactiveR: real ? r.reactive : null, reactiveP: real ? null : r.reactive, lostR: real ? r.lost : null, lostP: real ? null : r.lost, avoidedR: real ? r.avoided : null, avoidedP: real ? null : r.avoided, cumR: real ? cum : null, cumP: real ? null : cum };
    });
  }, [m]);
  if (f.error) return <div className="page"><ErrorState error={f.error} onRetry={f.reload} /></div>;
  if (!f.data) return <div className="page"><PageHeader title="Financial intelligence" /><div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div></div>;
  const { realized: r, projected: p } = f.data;
  const yearly = [{ y: "2025 (sim.)", cost: 1.38e6, avoided: 2.05e6 }, { y: "2026 YTD", cost: r.spend, avoided: r.avoided }];
  const compare = [{ name: "Planned job", cost: PLANNED_JOB_COST }, { name: "Emergency job", cost: EMERGENCY_JOB_COST }, { name: "Unplanned failure", cost: REACTIVE_FAILURE_COST }];
  const ax = { stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false } as const;
  const k = (v: number) => `€${Math.round(v / 1000)}k`;
  return (
    <div className="page">
      <PageHeader title="Financial intelligence" subtitle={<>Realised results are shown solid; projections are lighter and dashed <SimTag className="ml-1" /></>} actions={<Tabs value={view} onValueChange={setView}><TabsList><TabsTrigger value="monthly">Monthly</TabsTrigger><TabsTrigger value="yearly">Yearly</TabsTrigger></TabsList></Tabs>} />
      <div className="flex items-start gap-2 rounded-xl border border-ai/20 bg-ai-soft/50 p-3 text-sm text-ai-ink"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p><b>Realised</b> = work completed and costs incurred. <b>Projected</b> = estimates for work not yet complete or months not yet happened. They are never added together.</p></div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Net savings (realised)" value={eur(r.savings, true)} tone="ok" hint={<Badge variant="ok">Realised</Badge>} />
        <KpiCard label="Return on investment" value={`${num(r.roi, 1)}×`} tone="ok" hint={`on ${eur(r.programCost, true)} programme cost`} />
        <KpiCard label="Production losses (realised)" value={eur(r.lostRevenue, true)} tone="warn" hint={<Badge variant="ok">Realised</Badge>} />
        <KpiCard label="Pending projected savings" value={eur(p.pendingSavings, true)} tone="ai" hint={<span className="rounded border border-dashed border-ai/50 px-1.5 text-[10px] font-semibold uppercase text-ai-ink">Projected</span>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>{view === "monthly" ? "Maintenance cost trend" : "Year-over-year performance"}</CardTitle><CardDescription>{view === "monthly" ? "Planned vs reactive spend; last 3 bars are projected" : "Spend and avoided failure cost"}</CardDescription></div></CardHeader>
          <CardContent><div className="h-72" role="img" aria-label="Maintenance cost chart"><ResponsiveContainer width="100%" height="100%">
            {view === "monthly" ? (
              <BarChart data={rows} margin={{ left: -6, right: 8 }}><CartesianGrid stroke="#EEF2F7" vertical={false} /><XAxis dataKey="month" {...ax} /><YAxis {...ax} tickFormatter={k} /><Tooltip formatter={(v: unknown) => (typeof v === "number" ? eur(v) : "")} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="plannedR" name="Planned (realised)" stackId="a" fill={tokens.primary} isAnimationActive={false} /><Bar dataKey="reactiveR" name="Reactive (realised)" stackId="a" fill={tokens.crit} isAnimationActive={false} />
                <Bar dataKey="plannedP" name="Planned (projected)" stackId="a" fill="#BFDBFE" stroke={tokens.primary} strokeDasharray="4 3" isAnimationActive={false} /><Bar dataKey="reactiveP" name="Reactive (projected)" stackId="a" fill="#FECACA" stroke={tokens.crit} strokeDasharray="4 3" isAnimationActive={false} /></BarChart>
            ) : (
              <BarChart data={yearly} margin={{ left: -6, right: 8 }}><CartesianGrid stroke="#EEF2F7" vertical={false} /><XAxis dataKey="y" {...ax} /><YAxis {...ax} tickFormatter={(v) => `€${(v / 1e6).toFixed(1)}M`} /><Tooltip formatter={(v: number) => eur(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="cost" name="Maintenance spend" fill={tokens.primary} radius={[6, 6, 0, 0]} isAnimationActive={false} /><Bar dataKey="avoided" name="Avoided cost" fill={tokens.ok} radius={[6, 6, 0, 0]} isAnimationActive={false} /></BarChart>
            )}</ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Cost avoidance</CardTitle><CardDescription>Cumulative avoided failure cost (solid = realised, dashed = projected)</CardDescription></div></CardHeader>
          <CardContent><div className="h-72" role="img" aria-label="Cumulative cost avoidance chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={rows} margin={{ left: -2, right: 8 }}><CartesianGrid stroke="#EEF2F7" vertical={false} /><XAxis dataKey="month" {...ax} /><YAxis {...ax} tickFormatter={(v) => `€${(v / 1e6).toFixed(1)}M`} /><Tooltip formatter={(v: unknown) => (typeof v === "number" ? eur(v) : "")} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="cumR" name="Cumulative avoided (realised)" stroke={tokens.ok} fill={tokens.ok} fillOpacity={0.15} strokeWidth={2.2} isAnimationActive={false} connectNulls={false} />
            <Line type="monotone" dataKey="cumP" name="Projected" stroke={tokens.ai} strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Planned vs reactive cost per event</CardTitle><CardDescription>Why prediction pays: one avoided failure ≈ 5.6 planned jobs</CardDescription></div></CardHeader>
          <CardContent><div className="h-56" role="img" aria-label="Cost per event comparison"><ResponsiveContainer width="100%" height="100%"><BarChart data={compare} margin={{ left: -6, right: 8 }}><CartesianGrid stroke="#EEF2F7" vertical={false} /><XAxis dataKey="name" {...ax} /><YAxis {...ax} tickFormatter={k} /><Tooltip formatter={(v: number) => eur(v)} /><Bar dataKey="cost" radius={[6, 6, 0, 0]} barSize={46} fill={tokens.primary} isAnimationActive={false} label={{ position: "top", fontSize: 11, formatter: (v: number) => eur(v, true) }} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Production losses</CardTitle><CardDescription>Revenue lost during maintenance and downtime</CardDescription></div></CardHeader>
          <CardContent><div className="h-56" role="img" aria-label="Production losses chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ left: -6, right: 8 }}><CartesianGrid stroke="#EEF2F7" vertical={false} /><XAxis dataKey="month" {...ax} /><YAxis {...ax} tickFormatter={k} /><Tooltip formatter={(v: unknown) => (typeof v === "number" ? eur(v) : "")} /><Bar dataKey="lostR" name="Realised" fill={tokens.warn} radius={[4, 4, 0, 0]} isAnimationActive={false} /><Bar dataKey="lostP" name="Projected" fill="#FDE68A" stroke={tokens.warn} strokeDasharray="4 3" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle>Financial impact of upcoming maintenance</CardTitle><CardDescription>Projected until the work is completed</CardDescription></div></CardHeader>
        <div className="overflow-x-auto">
          {jobs.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No upcoming or recent interventions. Approve a plan from Demo mode to see its impact.</p> : (
            <table className="tbl w-full min-w-[720px]"><thead><tr><th>Intervention</th><th>Status</th><th>Cost</th><th>Lost production</th><th>Avoided failure cost</th><th>Net impact</th></tr></thead>
              <tbody>{jobs.map((j) => <tr key={j.id}><td className="font-medium">{j.label}</td><td><Badge variant={j.status === "completed" ? "ok" : "ai"}>{j.status === "completed" ? "Realised" : "Projected"}</Badge></td><td className="tabular-nums">{eur(j.plannedCost)}</td><td className="tabular-nums">{eur(j.lostRevenue)}</td><td className="tabular-nums">{eur(j.reactiveCostAvoided)}</td><td className="font-semibold tabular-nums text-ok-ink">{eur(j.reactiveCostAvoided - j.plannedCost - j.lostRevenue)}</td></tr>)}</tbody></table>
          )}
        </div>
      </Card>
    </div>
  );
}
