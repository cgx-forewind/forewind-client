import { lazy, Suspense, useState } from "react";
import { ArrowLeft, Clock, Database, ShieldQuestion } from "lucide-react";
import { useStore } from "@/store/useStore";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { go } from "@/lib/router";
import { AiExplain, CardSkeleton, EmptyState, ErrorState, KpiCard, PageHeader, RiskBadge, SimTag } from "@/components/common/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { fmtDateTime, num, pct } from "@/lib/utils";
import { turbineById } from "@/engine/fleet";

const TelemetryCharts = lazy(() => import("@/components/charts/TelemetryCharts").then((m) => ({ default: m.TelemetryCharts })));

export default function TurbineDetail({ id }: { id: string }) {
  const seed = turbineById(id);
  const t = useStore((s) => s.fleet.find((x) => x.id === id));
  const p = useStore((s) => s.prediction[id]);
  const d = useStore((s) => s.deg[id]);
  const maint = t?.maint;
  const [range, setRange] = useState("96");
  const tele = useAsync(() => api.getTelemetry(id, Math.round(d * 100) / 100, 96), [id, Math.round(d * 100)]);
  if (!seed || !t || !p) return <div className="page"><EmptyState title="Turbine not found" body={`No turbine with ID “${id}”.`} action={<Button size="sm" onClick={() => go("#/senior/turbines")}>Back to directory</Button>} /></div>;
  const data = tele.data ? tele.data.slice(-Number(range)) : undefined;
  const stale = p.dataAgeMin > 30;
  return (
    <div className="page">
      <button onClick={() => go("#/senior/turbines")} className="inline-flex items-center gap-1 text-sm text-muted hover:text-navy"><ArrowLeft className="h-4 w-4" /> All turbines</button>
      <PageHeader title={`${t.id} · ${t.site}`} subtitle={<>{t.model} · {t.bearing}</>} actions={<><RiskBadge risk={t.risk} /><SimTag /></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Failure risk" value={pct(p.riskScore)} tone={t.risk === "green" ? "ok" : t.risk === "yellow" ? "warn" : "crit"} hint={`Model confidence ${pct(p.confidence)}`} />
        <KpiCard label="Remaining useful life" value={t.risk === "green" ? "> 20 d" : `${num(p.rulDays)} d`} hint={t.risk === "green" ? "No degradation trend" : `80% interval ${num(p.rulLo)}–${num(p.rulHi)} d`} tone="primary" />
        <KpiCard label="Estimated failure date" value={t.risk === "green" ? "—" : new Date(p.failureDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} hint={t.risk === "green" ? "Not applicable" : `Earliest ${new Date(Date.now() + p.rulLo * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`} tone={t.risk === "green" ? "default" : "warn"} />
        <KpiCard label="Data freshness" value={`${p.dataAgeMin} min`} tone={stale ? "warn" : "ok"} icon={<Database className="h-4 w-4" />} hint={stale ? "Stale — offline" : "Within SLA (5 min)"} />
      </div>

      {t.risk !== "green" && (
        <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-soft/60 p-3 text-sm text-warn-ink"><ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" />
          <p><b>Prediction uncertainty.</b> The failure date is a probabilistic estimate: plan against the lower bound ({num(p.rulLo)} d), not the central value. {stale && "Data is stale — treat this as outdated until sync resumes."}</p></div>
      )}

      <AiExplain title="AI explanation — contributing factors">
        <ul className="list-disc space-y-1 pl-5">{p.explanation.map((x) => <li key={x}>{x}</li>)}</ul>
        <div className="mt-3 space-y-1.5">
          {p.contributions.map((c) => (
            <div key={c.sensor} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-xs"><span className="font-medium">{c.sensor}</span>
              <div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-ai transition-all" style={{ width: `${c.share * 100}%` }} /></div><span className="text-right tabular-nums">{pct(c.share)}</span></div>
          ))}
        </div>
      </AiExplain>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-muted" /> Sensor time-series</h2>
        <Tabs value={range} onValueChange={setRange}><TabsList><TabsTrigger value="24">24 h</TabsTrigger><TabsTrigger value="48">48 h</TabsTrigger><TabsTrigger value="96">96 h</TabsTrigger></TabsList></Tabs>
      </div>
      {tele.error ? <ErrorState error={tele.error} onRetry={tele.reload} /> : !data ? (
        <div className="grid gap-4 lg:grid-cols-2"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      ) : (
        <Suspense fallback={<div className="grid gap-4 lg:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>}><TelemetryCharts data={data} /></Suspense>
      )}

      <Card><CardHeader><CardTitle>Latest readings</CardTitle><span className="text-xs text-muted">{fmtDateTime(Date.now())}</span></CardHeader>
        <CardContent><dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">{[["Bearing temp", `${num(t.sensors.temp)} °C`], ["Residual", `${num(t.residual)} °C`], ["Vibration", `${num(t.sensors.vibration)} mm/s`], ["Rotor speed", `${num(t.sensors.rpm)} rpm`], ["Power", `${Math.round(t.sensors.power)} kW`]].map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-lg font-semibold tabular-nums">{v}</dd></div>))}</dl>
          {maint && maint !== "none" && <p className="mt-3 text-xs text-muted">Maintenance status: <b className="text-navy">{maint.replace("_", " ")}</b></p>}</CardContent></Card>
    </div>
  );
}
