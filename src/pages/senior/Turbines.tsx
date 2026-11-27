import { HistoricalMetrics } from "@/components/HistoricalMetrics";
import { sources } from "@/lib/trainingSources";
import { useMemo, useState } from "react";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import { useStore } from "@/store/useStore";
import { go } from "@/lib/router";
import { EmptyState, PageHeader, RiskBadge, SimTag } from "@/components/common/bits";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateLong, num, pct, cn } from "@/lib/utils";
import { Progress } from "@/components/ui/misc";
import type { Risk, TurbineView } from "@/types";

const maintLabel: Record<string, string> = { none: "—", awaiting_approval: "Awaiting approval", scheduled: "Scheduled", dispatching: "Dispatching", in_progress: "In progress", emergency: "Emergency response" };

export default function Turbines() {
  const [source, setSource] = useState("simulation");
  const fleet = useStore((s) => s.fleet);
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<Risk | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<{ k: keyof TurbineView | "rul"; dir: 1 | -1 }>({ k: "riskScore", dir: -1 });
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return fleet
      .filter((x) => (risk === "all" || x.risk === risk) && (status === "all" || x.status === status) && (!t || `${x.id} ${x.site} ${x.model}`.toLowerCase().includes(t)))
      .sort((a, b) => {
        const av = sort.k === "rul" ? a.rulDays ?? 999 : (a[sort.k] as number | string);
        const bv = sort.k === "rul" ? b.rulDays ?? 999 : (b[sort.k] as number | string);
        return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
      });
  }, [fleet, q, risk, status, sort]);
  const th = (label: string, k: typeof sort.k) => (
    <th scope="col"><button className="inline-flex items-center gap-1 uppercase" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>{label}<ArrowUpDown className="h-3 w-3 opacity-50" /></button></th>
  );
  const chip = (label: string, active: boolean, on: () => void) => (
    <button onClick={on} aria-pressed={active} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", active ? "border-primary bg-primary-50 text-primary" : "border-line bg-white text-muted hover:text-navy")}>{label}</button>
  );
  return (
    <div className="page">
      <PageHeader title="Turbine management" subtitle={source === "simulation" ? <>Fleet directory <SimTag className="ml-1" /></> : "Historical SCADA readings"} />
      <label>Dataset <select aria-label="Dataset" className="rounded border p-1" value={source} onChange={e => setSource(e.target.value)}>
        <option value="simulation">Simulated fleet</option>
        {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select></label>
      {source !== "simulation" ? <HistoricalMetrics key={source} source={source} /> :
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" /><Input aria-label="Search turbines" className="pl-9" placeholder="Search ID, site, model…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex flex-wrap items-center gap-1.5"><SlidersHorizontal className="h-4 w-4 text-muted" />
            {chip("All risks", risk === "all", () => setRisk("all"))}{chip("Healthy", risk === "green", () => setRisk("green"))}{chip("Degrading", risk === "yellow", () => setRisk("yellow"))}{chip("Critical", risk === "red", () => setRisk("red"))}</div>
          <div className="flex flex-wrap gap-1.5">{["all", "operational", "maintenance", "offline"].map((s) => chip(s === "all" ? "Any status" : s[0].toUpperCase() + s.slice(1), status === s, () => setStatus(s)))}</div>
          <span className="ml-auto text-xs text-muted">{rows.length} of {fleet.length}</span>
        </div>
        {rows.length === 0 ? <EmptyState title="No turbines match your filters" body="Try clearing the search or risk filters." action={<Button size="sm" variant="outline" onClick={() => { setQ(""); setRisk("all"); setStatus("all"); }}>Clear filters</Button>} /> : (
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[920px]">
              <thead><tr>{th("Turbine", "id")}<th scope="col">Status</th>{th("Bearing health", "riskScore")}{th("Risk", "riskScore")}{th("RUL", "rul")}<th scope="col">Latest sensors</th><th scope="col">Maintenance</th>{th("Last inspection", "lastInspection")}</tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="cursor-pointer" tabIndex={0} onClick={() => go(`#/senior/turbines/${t.id}`)} onKeyDown={(e) => e.key === "Enter" && go(`#/senior/turbines/${t.id}`)}>
                    <td><p className="font-semibold">{t.id}</p><p className="text-xs text-muted">{t.site} · {t.model}</p></td>
                    <td><Badge variant={t.status === "operational" ? "ok" : t.status === "maintenance" ? "primary" : "default"}>{t.status}</Badge></td>
                    <td className="w-40"><div className="flex items-center gap-2"><Progress value={(1 - t.riskScore) * 100} color={t.risk === "green" ? "#16A34A" : t.risk === "yellow" ? "#F59E0B" : "#DC2626"} /><span className="w-9 text-xs tabular-nums text-muted">{Math.round((1 - t.riskScore) * 100)}%</span></div></td>
                    <td><div className="flex items-center gap-2"><RiskBadge risk={t.risk} /><span className="text-xs tabular-nums text-muted">{pct(t.riskScore)}</span></div></td>
                    <td className="tabular-nums">{t.rulDays ? `${num(t.rulDays)} d` : <span className="text-muted">&gt; 20 d</span>}</td>
                    <td className="text-xs tabular-nums text-muted">{num(t.sensors.temp)} °C · {num(t.sensors.vibration)} mm/s<br />{Math.round(t.sensors.power)} kW · {num(t.sensors.rpm)} rpm</td>
                    <td className="text-xs">{maintLabel[t.maint]}</td>
                    <td className="text-xs text-muted">{fmtDateLong(t.lastInspection)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>}
    </div>
  );
}
