import { useState } from "react";
import { BrainCircuit, CheckCircle2, CircleDashed, Info, TriangleAlert, XCircle, Loader2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import { AiExplain, EmptyState, PageHeader, SimTag } from "@/components/common/bits";
import { CallStatusCard } from "@/components/common/call";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, fmtTimeSec, eur } from "@/lib/utils";
import { TECHNICIANS } from "@/engine/fleet";

const STEPS = ["Sensor anomaly detected", "Bearing degradation identified", "Failure risk evaluated", "Remaining useful life estimated", "Maintenance windows analysed", "Financial & safety constraints evaluated", "Qualified technicians ranked", "Technician selected", "Approval requested / emergency initiated", "Assignment communicated", "Stakeholders notified", "Maintenance progress monitored", "Final report generated"];

export default function Engine() {
  const events = useStore((s) => s.events);
  const call = useStore((s) => s.call);
  const sc = useStore((s) => s.scenario);
  const a = useStore((s) => s.assignment);
  const cands = useStore((s) => s.candidates);
  const [open, setOpen] = useState<string | null>(null);
  const done = new Set(events.map((e) => e.step));
  const maxStep = Math.max(0, ...events.map((e) => e.step));
  const feed = [...events].reverse();
  const red = sc.kind === "red" && sc.phase !== "completed";
  const tone = (s: string) => (s === "failed" ? "text-crit" : s === "warning" ? "text-warn" : s === "active" ? "text-primary" : "text-ok");

  return (
    <div className="page">
      <PageHeader title="Unified intelligence engine" subtitle={<>One engine: prediction → optimisation → dispatch → communication → reporting <SimTag className="ml-1" /></>} actions={<Badge variant="ai"><BrainCircuit className="h-3 w-3" /> Engine online</Badge>} />

      {red && (
        <Card className="border-crit/40 ring-1 ring-crit/20">
          <CardHeader><div><CardTitle className="text-crit-ink">Live incident report — {sc.turbineId}</CardTitle><CardDescription>Emergency priority overrides financial optimisation. Dispatch never authorises unsafe work.</CardDescription></div><Badge variant="crit">RED</Badge></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p><b>Status:</b> {sc.phase === "escalated" ? "Escalated — automated dispatch stopped, manual control required." : sc.phase === "calling" ? "Calling qualified technicians in order of response time." : a ? `${TECHNICIANS.find((t) => t.id === a.techId)?.name} ${a.status.replace("_", " ")} · ETA ${a.etaMin} min.` : "Initiating."}</p>
              <p className="text-muted">Candidates (by ETA): {cands.filter((c) => c.qualified).map((c) => `${c.tech.name} ${c.etaMin} min`).join(" → ") || "—"}</p>
              <p className="text-muted">Exposure if unplanned failure: {eur(236000)} (simulated estimate).</p>
            </div>
            {call && <CallStatusCard call={call} />}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><div><CardTitle>Decision pipeline</CardTitle><CardDescription>13 stages — completed stages are lit as the scenario runs</CardDescription></div></CardHeader>
        <CardContent>
          <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const isDone = done.has(n);
              const active = n === maxStep && sc.phase !== "completed" && events.length > 0;
              return (
                <li key={s} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm", active && "bg-primary-50", isDone ? "text-navy" : "text-slate-400")}>
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", isDone ? "bg-ok text-white" : "bg-slate-100")}>{isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}</span>
                  <span className="min-w-0 flex-1 leading-tight">{s}</span>{active && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-label="in progress" />}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Engine decision timeline</CardTitle><CardDescription>Chronological · timestamp, status, explanation and supporting information</CardDescription></div></CardHeader>
        <CardContent>
          {feed.length === 0 ? <EmptyState title="No engine activity yet" body="Open Demo mode and start a scenario — each decision will appear here in real time." /> : (
            <ol className="relative space-y-4 border-l border-line pl-6">
              {feed.map((e) => {
                const Icon = e.status === "failed" ? XCircle : e.status === "warning" ? TriangleAlert : e.status === "active" ? CircleDashed : CheckCircle2;
                return (
                  <li key={e.id} className="relative animate-slideUp">
                    <span className={cn("absolute -left-[34px] top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white", tone(e.status))}><Icon className="h-5 w-5" /></span>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-xs tabular-nums text-muted">{fmtTimeSec(e.ts)}</span><Badge variant="ai">Step {e.step}</Badge><Badge variant={e.status === "failed" ? "crit" : e.status === "warning" ? "warn" : e.status === "active" ? "primary" : "ok"}>{e.status}</Badge>{e.turbineId && <Badge variant="outline">{e.turbineId}</Badge>}<Badge variant="outline">{e.actor}</Badge></div>
                    <p className="mt-1 text-sm font-semibold">{e.title}</p>
                    <p className="text-sm text-slate-600">{e.explanation}</p>
                    {e.details.length > 0 && (
                      <>
                        <button onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><Info className="h-3 w-3" /> Supporting information</button>
                        {open === e.id && <dl className="mt-1.5 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3 animate-fadeIn">{e.details.map((d) => <div key={d.label}><dt className="text-muted">{d.label}</dt><dd className="font-semibold">{d.value}</dd></div>)}</dl>}
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
      <AiExplain title="How to read this"><p>Every stage is produced by the same engine — prediction, optimisation, safety checks and communication share one state. Humans stay in the loop: planned work always requires senior approval, and no stage replaces on-site safety clearance.</p></AiExplain>
    </div>
  );
}
