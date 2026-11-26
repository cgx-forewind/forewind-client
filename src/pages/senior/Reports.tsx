import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { useStore } from "@/store/useStore";
import { CardSkeleton, ErrorState, KpiCard, PageHeader, SimTag } from "@/components/common/bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { eur, fmtDateLong, pct } from "@/lib/utils";
import { tokens } from "@/lib/tokens";

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const r = useAsync(() => api.getReports(), []);
  const fin = useStore((s) => s.fin);
  const events = useStore((s) => s.events);
  const toast = useStore((s) => s.toast);
  const [kind, setKind] = useState("ops");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ title: string; body: string; ts: number } | null>(null);

  if (r.error) return <div className="page"><ErrorState error={r.error} onRetry={r.reload} /></div>;
  if (!r.data) return <div className="page"><PageHeader title="Reports" /><div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div></div>;
  const d = r.data;

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      const title = { ops: "Two-week operational report", maint: "Maintenance history report", inc: "Incident report", perf: "Maintenance performance report" }[kind]!;
      const lines = [`# ${title}`, `Generated ${new Date().toLocaleString("en-GB")} — SIMULATED DATA (not verified SKF data)`, "",
        `Fleet availability (14 d): 97.4 %`, `Failures prevented YTD: ${fin.realized.prevented}`, `Realised net savings YTD: ${eur(fin.realized.savings)}`, `Projected (not realised): ${eur(fin.projected.pendingSavings)}`, "",
        "## Maintenance history", ...d.history.map((h) => `- ${h.id} ${h.turbineId} ${fmtDateLong(h.date)} ${h.type}: ${h.action} (${h.outcome})`), "",
        "## Incidents", ...d.incidents.map((i) => `- ${i.id} ${i.turbineId} [${i.severity}] ${i.summary}`), "",
        "## Engine events this session", ...(events.length ? events.map((e) => `- step ${e.step}: ${e.title}`) : ["- none"])];
      setGenerated({ title, body: lines.join("\n"), ts: Date.now() });
      setGenerating(false);
      toast({ tone: "success", title: "Report generated", body: title });
    }, 700);
  };
  const csv = () => {
    const rows = [["id", "turbine", "date", "type", "action", "duration_h", "technician", "cost_eur", "outcome"], ...d.history.map((h) => [h.id, h.turbineId, new Date(h.date).toISOString().slice(0, 10), h.type, h.action, h.durationH, h.tech, h.cost, h.outcome])];
    download("maintenance-history.csv", rows.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
    toast({ tone: "success", title: "CSV exported" });
  };

  return (
    <div className="page">
      <PageHeader title="Reports" subtitle={<>Operational and maintenance reporting <SimTag className="ml-1" /></>} actions={<><Button variant="outline" onClick={csv}><Download className="h-4 w-4" /> Export CSV</Button><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{d.performance.map((p) => <KpiCard key={p.label} label={p.label} value={p.value} sim />)}</div>

      <Tabs defaultValue="history">
        <TabsList className="flex-wrap"><TabsTrigger value="history">Maintenance history</TabsTrigger><TabsTrigger value="trends">Sensor trends</TabsTrigger><TabsTrigger value="pvo">Predicted vs observed</TabsTrigger><TabsTrigger value="incidents">Incidents</TabsTrigger><TabsTrigger value="generate">Generate &amp; export</TabsTrigger></TabsList>
        <TabsContent value="history"><Card><div className="overflow-x-auto"><table className="tbl w-full min-w-[820px]"><thead><tr><th>Order</th><th>Turbine</th><th>Date</th><th>Type</th><th>Action</th><th>Duration</th><th>Technician</th><th>Cost</th><th>Outcome</th></tr></thead>
          <tbody>{d.history.map((h) => <tr key={h.id}><td className="font-medium">{h.id}</td><td>{h.turbineId}</td><td className="whitespace-nowrap text-xs">{fmtDateLong(h.date)}</td><td><Badge variant={h.type === "Reactive" ? "crit" : h.type === "Planned" ? "primary" : "default"}>{h.type}</Badge></td><td className="text-sm">{h.action}</td><td>{h.durationH} h</td><td className="text-sm">{h.tech}</td><td className="tabular-nums">{eur(h.cost)}</td><td className="text-xs text-muted">{h.outcome}</td></tr>)}</tbody></table></div></Card></TabsContent>
        <TabsContent value="trends"><Card><CardHeader><div><CardTitle>Fleet sensor trends — 14 days</CardTitle><CardDescription>Mean bearing temperature residual (°C) and vibration (mm/s)</CardDescription></div></CardHeader><CardContent><div className="h-72" role="img" aria-label="Fleet sensor trend chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={d.trend} margin={{ left: -10, right: 8 }}><CartesianGrid stroke="#EEF2F7" vertical={false} /><XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} /><YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} /><Tooltip /><Line name="Residual °C" dataKey="residual" stroke={tokens.ai} strokeWidth={2} dot={false} isAnimationActive={false} /><Line name="Vibration mm/s" dataKey="vibration" stroke="#0EA5E9" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></CardContent></Card></TabsContent>
        <TabsContent value="pvo"><Card><div className="overflow-x-auto"><table className="tbl w-full min-w-[640px]"><thead><tr><th>Turbine</th><th>Predicted failure</th><th>Observed</th><th>Error</th><th>Result</th></tr></thead>
          <tbody>{d.predVsObs.map((p) => <tr key={p.turbineId}><td className="font-medium">{p.turbineId}</td><td className="text-xs">{fmtDateLong(p.predicted)}</td><td className="text-sm">{p.observed}</td><td className="tabular-nums">{p.errorDays.toFixed(1)} d</td><td><Badge variant={p.result === "Late warning" || p.result === "False positive" ? "warn" : "ok"}>{p.result}</Badge></td></tr>)}</tbody></table></div>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">Where outcomes are available. Prevented failures are counted as correct only when inspection confirmed damage. Simulated.</p></Card></TabsContent>
        <TabsContent value="incidents"><Card><ul className="divide-y divide-line">{d.incidents.map((i) => <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><Badge variant={i.severity === "Red" ? "crit" : "warn"}>{i.severity}</Badge><b>{i.id}</b><span className="text-muted">{i.turbineId} · {fmtDateLong(i.date)}</span><span className="basis-full text-slate-700 sm:basis-auto">{i.summary}</span></li>)}</ul></Card></TabsContent>
        <TabsContent value="generate">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader><CardTitle>Report builder</CardTitle></CardHeader><CardContent className="space-y-3">
              <label className="block text-xs font-medium text-muted" htmlFor="rk">Report type</label>
              <select id="rk" value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-white px-2 text-sm"><option value="ops">Two-week operations</option><option value="maint">Maintenance history</option><option value="inc">Incident report</option><option value="perf">Maintenance performance</option></select>
              <Button className="w-full" onClick={generate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generate report</Button></CardContent></Card>
            <Card className="lg:col-span-2"><CardHeader><div><CardTitle>Preview</CardTitle><CardDescription>{generated ? `${generated.title} · ${new Date(generated.ts).toLocaleTimeString("en-GB")}` : "Generate a report to preview it here"}</CardDescription></div>
              {generated && <Button size="sm" variant="outline" onClick={() => download("cgx-report.md", generated.body, "text/markdown")}><Download className="h-3.5 w-3.5" /> Download</Button>}</CardHeader>
              <CardContent>{generated ? <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed">{generated.body}</pre> : <p className="py-10 text-center text-sm text-muted">Nothing generated yet.</p>}</CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted">Availability {pct(0.974, 1)} · all figures simulated.</p>
    </div>
  );
}
