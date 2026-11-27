import { TrainingSources } from "@/components/TrainingSources";
import { WarehouseSignals } from "@/components/WarehouseSignals";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardCheck, Cpu, ListChecks, Search } from "lucide-react";
import { useStore } from "@/store/useStore";
import { go } from "@/lib/router";
import { AiExplain, EmptyState, KpiCard, PageHeader, RiskBadge, SimTag } from "@/components/common/bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime, num, pct } from "@/lib/utils";
import { INCIDENTS } from "@/engine/history";
import { RESIDUAL_SIGMA, degToRisk, degToRul } from "@/engine/telemetry";
import { tokens } from "@/lib/tokens";

export default function Predictive() {
  const fleet = useStore((s) => s.fleet);
  const pred = useStore((s) => s.prediction);
  const events = useStore((s) => s.events);
  const sc = useStore((s) => s.scenario);
  const deg = useStore((s) => s.deg);
  const [pick, setPick] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const atRisk = fleet.filter((t) => t.risk !== "green").sort((a, b) => b.riskScore - a.riskScore);
  const sel = pick ?? sc.turbineId ?? atRisk[0]?.id ?? [...fleet].sort((a, b) => b.riskScore - a.riskScore)[0].id;
  const t = fleet.find((x) => x.id === sel)!;
  const p = pred[sel];
  const counts = { green: fleet.filter((x) => x.risk === "green").length, yellow: fleet.filter((x) => x.risk === "yellow").length, red: fleet.filter((x) => x.risk === "red").length };
  const history = [
    ...events.filter((e) => e.status !== "done").map((e) => ({ id: e.id, ts: e.ts, turbine: e.turbineId ?? "—", sev: e.status === "failed" ? "Red" : "Yellow", text: e.title })),
    ...INCIDENTS.map((i) => ({ id: i.id, ts: i.date, turbine: i.turbineId, sev: i.severity, text: i.summary })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 8);
  const d = deg[sel];

  return (
    <div className="page">
      <PageHeader title="Predictive maintenance" subtitle={<>Failure predictions, RUL and reasoning <SimTag className="ml-1" /></>} />
      <a className="block rounded-lg border border-line bg-white p-4 hover:border-primary" href="./care/event40.html">
        <strong>Explore the historical CARE replay →</strong>
        <span className="block text-sm text-muted">Farm A · Turbine 10 · Event 40. Inspect recorded bearing temperatures and model alert onsets.</span>
      </a>
      <TrainingSources />
      <WarehouseSignals />
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Green · healthy" value={counts.green} tone="ok" hint="Risk < 35 %" />
        <KpiCard label="Yellow · degrading" value={counts.yellow} tone="warn" hint="35–75 % — plan maintenance" />
        <KpiCard label="Red · critical" value={counts.red} tone="crit" hint="≥ 75 % — emergency" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader><div><CardTitle>Predicted bearing failures</CardTitle><CardDescription>Turbines above the yellow threshold</CardDescription></div></CardHeader>
          <CardContent>
            {atRisk.length === 0 ? <EmptyState title="No predicted failures" body="All turbines are green. Use Demo mode to simulate degradation." /> : (
              <ul className="space-y-2">{atRisk.map((x) => (
                <li key={x.id}><button onClick={() => setPick(x.id)} aria-pressed={sel === x.id} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${sel === x.id ? "border-primary bg-primary-50" : "border-line hover:bg-slate-50"}`}>
                  <div className="flex-1"><p className="font-semibold">{x.id}</p><p className="text-xs text-muted">RUL {num(x.rulDays ?? 0)} d · failure ≈ {fmtDateTime(pred[x.id].failureDate)}</p></div><RiskBadge risk={x.risk} /></button></li>
              ))}</ul>
            )}
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Or inspect any turbine</p>
            <select aria-label="Select turbine" value={sel} onChange={(e) => setPick(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-white px-2 text-sm">
              {fleet.map((x) => <option key={x.id} value={x.id}>{x.id} — {x.risk}</option>)}
            </select>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <div><CardTitle>{t.id} — prediction detail</CardTitle><CardDescription>Model confidence {pct(p.confidence)} · data age {p.dataAgeMin} min</CardDescription></div>
            <div className="flex items-center gap-2"><RiskBadge risk={t.risk} /><Button size="sm" variant="outline" onClick={() => setWhy(true)}><Search className="h-3.5 w-3.5" /> Inspect reasoning</Button></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[["Risk score", pct(p.riskScore)], ["Anomaly score", num(p.anomaly, 2)], ["RUL", t.risk === "green" ? "> 20 d" : `${num(p.rulDays)} d`], ["RUL band (80 %)", t.risk === "green" ? "—" : `${num(p.rulLo)}–${num(p.rulHi)} d`]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-lg font-semibold tabular-nums">{v}</dd></div>)}
            </dl>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">Sensor contributions</p>
              <div className="h-44" role="img" aria-label="Sensor contribution chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={p.contributions.map((c) => ({ name: c.sensor, v: Math.round(c.share * 100) }))} layout="vertical" margin={{ left: 20, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#EEF2F7" /><XAxis type="number" unit="%" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={140} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => `${v} %`} cursor={{ fill: "#F1F5F9" }} />
                    <Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={14} isAnimationActive={false}>{p.contributions.map((c, i) => <Cell key={c.sensor} fill={i === 0 ? tokens.ai : "#C4B5FD"} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted"><ListChecks className="h-3.5 w-3.5" /> Recommended actions</p>
              <ul className="space-y-1.5">{p.recommended.map((r) => <li key={r} className="flex gap-2 text-sm"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{r}</li>)}</ul>
              {t.risk === "yellow" && <Button size="sm" className="mt-3" onClick={() => go("#/senior/optimization")}>Open maintenance optimisation</Button>}
            </div>
          </CardContent>
        </Card>
      </div>

      <AiExplain title="Technical explanation"><p>{p.explanation.join(" ")}</p></AiExplain>

      <Card>
        <CardHeader><div><CardTitle>Alert history</CardTitle><CardDescription>Live engine alerts and past incidents (simulated)</CardDescription></div></CardHeader>
        <div className="overflow-x-auto"><table className="tbl w-full min-w-[640px]"><thead><tr><th>Time</th><th>Turbine</th><th>Severity</th><th>Event</th></tr></thead>
          <tbody>{history.map((h) => <tr key={h.id}><td className="whitespace-nowrap text-xs text-muted">{fmtDateTime(h.ts)}</td><td className="font-medium">{h.turbine}</td><td><Badge variant={h.sev === "Red" ? "crit" : "warn"}>{h.sev}</Badge></td><td className="text-sm">{h.text}</td></tr>)}</tbody></table></div>
      </Card>

      <Dialog open={why} onOpenChange={setWhy}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold"><Cpu className="h-4 w-4 text-ai" /> Reasoning — {t.id}</DialogTitle>
          <DialogDescription className="text-xs text-muted">Step-by-step trace of how the engine arrived at its recommendation (simulated surrogate model).</DialogDescription>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              ["1 · Residual", `r = T_meas − T_exp = ${num(t.residual)} °C → z = r/σ = ${num(t.residual / RESIDUAL_SIGMA)} (σ = ${RESIDUAL_SIGMA} °C healthy scatter).`],
              ["2 · Anomaly", `A = 1 − exp(−(r/8)²) = ${num(p.anomaly, 2)}. Persistent for > 24 h, so it is treated as drift, not noise.`],
              ["3 · Degradation index", `Fused trend of residual and vibration gives d ≈ ${num(d, 2)} (0 healthy → 1 failed).`],
              ["4 · Risk", `risk = 0.04 + 0.93·d^1.3 = ${pct(degToRisk(d))}; thresholds: yellow ≥ 35 %, red ≥ 75 % → ${t.risk.toUpperCase()}.`],
              ["5 · RUL", `RUL = 20·(1 − d)^1.3 = ${num(degToRul(d))} d; 80 % interval ×[0.74, 1.32]. Safety margins use the lower bound ${num(p.rulLo)} d.`],
              ["6 · Recommendation", p.recommended[0] + ". Cost optimisation is only applied inside safety constraints; red status overrides it entirely."],
            ].map(([h, b]) => <li key={h} className="rounded-lg border border-line p-3"><p className="text-xs font-semibold text-ai-ink">{h}</p><p className="mt-0.5 text-slate-700">{b}</p></li>)}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
