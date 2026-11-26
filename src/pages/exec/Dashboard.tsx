import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Banknote, Gauge, PiggyBank, ShieldCheck, TrendingDown, Wrench, Phone, Sparkles, Siren, Target } from "lucide-react";
import { useStore } from "@/store/useStore";
import { go } from "@/lib/router";
import { AiExplain, KpiCard, PageHeader, SimTag } from "@/components/common/bits";
import { VoiceBriefing } from "@/components/common/call";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eur, pct, relTime } from "@/lib/utils";
import { tokens } from "@/lib/tokens";
import { REACTIVE_FAILURE_COST } from "@/engine/finance";

export function execSummary(s: ReturnType<typeof useStore.getState>) {
  const op = s.fleet.filter((t) => t.status === "operational").length / s.fleet.length;
  const risky = s.fleet.filter((t) => t.risk !== "green" && t.status !== "maintenance");
  const lines = [
    `Fleet availability is ${pct(op, 1)}. ${risky.length ? `${risky.length} turbine${risky.length > 1 ? "s need" : " needs"} attention: ${risky.map((t) => t.id).join(", ")}.` : "No turbines are currently at risk."}`,
    `Year to date, predictive maintenance has avoided about ${eur(s.fin.realized.avoided, true)} in failure costs. After programme costs, net savings are ${eur(s.fin.realized.savings, true)} — realised.`,
  ];
  if (s.fin.projected.openJobs) lines.push(`${s.fin.projected.openJobs} repair${s.fin.projected.openJobs > 1 ? "s are" : " is"} in progress. If completed as planned, a further ${eur(s.fin.projected.pendingSavings, true)} becomes realised. This is a projection until the work is done.`);
  else lines.push("No repairs are in progress, so there are no pending projected savings.");
  if (s.scenario.kind === "red" && s.scenario.phase !== "completed") lines.push(`A critical bearing risk on ${s.scenario.turbineId} is being handled as an emergency. If it failed unplanned it could cost about ${eur(REACTIVE_FAILURE_COST, true)}.`);
  lines.push("All figures are simulated for this demo.");
  return lines;
}

export default function ExecDashboard() {
  const s = useStore();
  const { fin, fleet, events, notices } = s;
  const [voice, setVoice] = useState(false);
  const op = fleet.filter((t) => t.status === "operational").length;
  const maintCount = fleet.filter((t) => t.status === "maintenance").length;
  const offline = fleet.filter((t) => t.status === "offline").length;
  const atRisk = fleet.filter((t) => t.risk !== "green" && t.status !== "maintenance");
  const lines = useMemo(() => execSummary(useStore.getState()), [fin, fleet, s.scenario]); // eslint-disable-line react-hooks/exhaustive-deps
  const donut = [{ name: "Planned", value: fin.realized.plannedSpend, c: tokens.primary }, { name: "Unplanned (reactive)", value: fin.realized.reactiveSpend, c: tokens.crit }];
  const status = [{ name: "Operational", v: op, c: tokens.ok }, { name: "Maintenance", v: maintCount, c: tokens.secondary }, { name: "Offline", v: offline, c: "#94A3B8" }, { name: "At risk", v: atRisk.length, c: tokens.warn }];
  const decisions = events.filter((e) => e.actor === "engine" && [3, 6, 8, 11, 13].includes(e.step)).slice(-4).reverse();
  const risks = [
    ...atRisk.map((t) => ({ t: `${t.id}: ${t.risk === "red" ? "critical bearing risk" : "bearing degradation"}`, impact: `Up to ${eur(REACTIVE_FAILURE_COST, true)} if unplanned`, tone: t.risk })),
    { t: "Winter wind volatility", impact: "May shift maintenance windows; modest revenue effect", tone: "green" as const },
  ];
  return (
    <div className="page">
      <PageHeader title="Executive dashboard" subtitle={<>Financial impact and business performance <SimTag className="ml-1" /></>} actions={<Button variant="ai" onClick={() => setVoice(true)}><Phone className="h-4 w-4" /> Voice briefing</Button>} />
      {voice && <VoiceBriefing lines={lines} onEnd={() => setVoice(false)} />}

      <AiExplain title="AI executive summary">{lines.slice(0, -1).map((l) => <p key={l}>{l}</p>)}<p className="text-xs text-muted">{lines[lines.length - 1]}</p></AiExplain>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Maintenance expenditure (YTD)" value={eur(fin.realized.spend, true)} icon={<Wrench className="h-4 w-4" />} hint={<Badge variant="ok">Realised</Badge>} />
        <KpiCard label="Avoided downtime cost" value={eur(fin.realized.avoided, true)} icon={<ShieldCheck className="h-4 w-4" />} tone="ok" hint={<Badge variant="ok">Realised · est.</Badge>} />
        <KpiCard label="Net savings (YTD)" value={eur(fin.realized.savings, true)} icon={<PiggyBank className="h-4 w-4" />} tone="ok" hint={<Badge variant="ok">Realised · est.</Badge>} onClick={() => go("#/exec/financial")} />
        <KpiCard label="Revenue lost to downtime" value={eur(fin.realized.lostRevenue, true)} icon={<TrendingDown className="h-4 w-4" />} tone="warn" hint={<Badge variant="ok">Realised</Badge>} />
        <KpiCard label="Fleet availability" value={pct(op / fleet.length, 1)} icon={<Gauge className="h-4 w-4" />} tone="primary" hint={`${op} of ${fleet.length} operating`} />
        <KpiCard label="Failures predicted / prevented" value={`${fin.realized.predicted} / ${fin.realized.prevented}`} icon={<Target className="h-4 w-4" />} tone="ai" hint="Where outcomes known" />
        <KpiCard label="Projected savings pending" value={eur(fin.projected.pendingSavings, true)} icon={<Banknote className="h-4 w-4" />} tone="ai" hint={<span className="rounded border border-dashed border-ai/50 px-1.5 text-[10px] font-semibold uppercase text-ai-ink">Projected</span>} />
        <KpiCard label="Critical business risks" value={atRisk.length} icon={<Siren className="h-4 w-4" />} tone={atRisk.length ? "crit" : "ok"} hint={atRisk.length ? "Response under way" : "None active"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><div><CardTitle>Planned vs unplanned maintenance</CardTitle><CardDescription>Year-to-date spend</CardDescription></div></CardHeader>
          <CardContent><div className="h-52" role="img" aria-label="Planned versus unplanned spend"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" innerRadius={52} outerRadius={80} paddingAngle={3} isAnimationActive={false}>{donut.map((d) => <Cell key={d.name} fill={d.c} />)}</Pie><Tooltip formatter={(v: number) => eur(v)} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer></div>
            <p className="mt-1 text-center text-xs text-muted">{pct(fin.realized.plannedSpend / (fin.realized.plannedSpend + fin.realized.reactiveSpend))} planned · {fin.realized.plannedJobs} planned jobs vs {fin.realized.reactiveJobs} reactive</p></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Turbine operational status</CardTitle><CardDescription>{fleet.length} turbines</CardDescription></div><Button variant="ghost" size="sm" onClick={() => go("#/exec/assets")}>Asset overview</Button></CardHeader>
          <CardContent><div className="h-52" role="img" aria-label="Turbine status chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={status} layout="vertical" margin={{ left: 10, right: 16 }}><CartesianGrid horizontal={false} stroke="#EEF2F7" /><XAxis type="number" allowDecimals={false} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={86} stroke="#475569" fontSize={12} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: "#F1F5F9" }} /><Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={16} isAnimationActive={false}>{status.map((d) => <Cell key={d.name} fill={d.c} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Critical business risks</CardTitle><CardDescription>Plain-language view</CardDescription></div></CardHeader>
          <CardContent><ul className="space-y-2.5">{risks.map((r) => <li key={r.t} className="flex items-start gap-2.5"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${r.tone === "red" ? "bg-crit" : r.tone === "yellow" ? "bg-warn" : "bg-ok"}`} /><div><p className="text-sm font-medium leading-tight">{r.t}</p><p className="text-xs text-muted">{r.impact}</p></div></li>)}</ul></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-ai" /> Recent AI decisions &amp; financial impact</CardTitle></div></CardHeader>
          <CardContent>
            {decisions.length === 0 && s.jobs.length === 0 ? <p className="py-6 text-center text-sm text-muted">No decisions yet. Run a scenario from Demo mode.</p> : (
              <ul className="space-y-3">
                {s.jobs.map((j) => <li key={j.id} className="rounded-lg border border-line p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">{j.label}</p><Badge variant={j.status === "completed" ? "ok" : "ai"}>{j.status === "completed" ? "Realised" : "Projected"}</Badge></div><p className="mt-1 text-xs text-muted">Cost {eur(j.plannedCost)} + lost production {eur(j.lostRevenue)} vs unplanned failure ≈ {eur(j.reactiveCostAvoided, true)} → net {eur(j.reactiveCostAvoided - j.plannedCost - j.lostRevenue, true)}.</p></li>)}
                {decisions.map((e) => <li key={e.id} className="text-sm"><span className="font-medium">{e.title}</span><span className="ml-2 text-xs text-muted">{relTime(e.ts)}</span></li>)}
              </ul>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Proactive notifications</CardTitle></div></CardHeader>
          <CardContent>{(() => { const n = notices.filter((x) => x.roles.includes("executive")).slice(0, 4); return n.length ? <ul className="space-y-2.5">{n.map((x) => <li key={x.id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm font-semibold">{x.title}</p><p className="text-xs text-muted">{x.body}</p></li>)}</ul> : <p className="py-6 text-center text-sm text-muted">Nothing needs your attention.</p>; })()}</CardContent>
        </Card>
      </div>
    </div>
  );
}
