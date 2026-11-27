import { useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, CheckCircle2, ShieldAlert, ThumbsDown, ThumbsUp, Trophy, XCircle, Wind, Zap, Users, Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import { AiExplain, EmptyState, KpiCard, PageHeader, SimTag } from "@/components/common/bits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from "@/components/ui/misc";
import { cn, eur, fmtDate, fmtDateTime, fmtTime, num } from "@/lib/utils";
import { dayStart } from "@/engine/fleet";
import { tokens } from "@/lib/tokens";
import type { MaintWindow } from "@/types";

import WindForecast from "./WindForecast";

const DAY = 86400000;

export default function Optimization() {
  const windows = useStore((s) => s.windows);
  const selId = useStore((s) => s.selectedWindowId);
  const select = useStore((s) => s.selectWindow);
  const approval = useStore((s) => s.approval);
  const approve = useStore((s) => s.approvePlan);
  const reject = useStore((s) => s.rejectPlan);
  const show = useStore((s) => s.showWindows);
  const sc = useStore((s) => s.scenario);
  const assignment = useStore((s) => s.assignment);
  const clearance = useStore((s) => s.clearanceItems);
  const [rej, setRej] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const sel = windows.find((w) => w.id === selId);
  const ranked = useMemo(() => [...windows].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.start - b.start), [windows]);
  const best = windows.find((w) => w.cheapestEligible);
  const chart = useMemo(() => [...windows].sort((a, b) => a.start - b.start).map((w) => ({ id: w.id, label: `${fmtDate(w.start).replace(/^\w+ /, "")} ${fmtTime(w.start)}`, lost: w.lostRevenue, margin: w.safetyMarginH, eligible: w.eligible, best: w.cheapestEligible })), [windows]);
  const days = Array.from({ length: 7 }, (_, i) => dayStart() + (i + 1) * DAY);
  const deadline = windows[0]?.failureDeadline;
  const clearanceConfirmed = clearance.every(Boolean) && !!assignment && ["cleared", "in_progress", "completed"].includes(assignment.status);

  if (sc.kind === "red")
    return (
      <div className="page"><PageHeader title="Maintenance optimisation" />
        <WindForecast />
        <div className="rounded-xl border border-crit/30 bg-crit-soft p-5 text-crit-ink"><p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-5 w-5" /> Optimisation bypassed for {sc.turbineId}</p>
          <p className="mt-1 text-sm">Emergency priority overrides financial optimisation. The engine is dispatching immediately; no revenue-based delay is allowed. See Engine Activity for the live incident.</p>
          <Button className="mt-3" variant="destructive" size="sm" onClick={() => (window.location.hash = "#/senior/engine")}>Open live incident</Button></div></div>
    );

  if (!windows.length)
    return (
      <div className="page"><PageHeader title="Maintenance optimisation" subtitle={<>Compare recommended maintenance windows <SimTag className="ml-1" /></>} />
        <WindForecast />
        <Card><EmptyState title="No maintenance plan to review" body="Windows are computed when the engine raises a yellow alert. Raise one now, or use Demo mode." action={<Button size="sm" disabled={busy} onClick={async () => { setBusy(true); await show(); setBusy(false); }}>{busy ? "Analysing…" : "Run engine on WT-07 (demo)"}</Button>} /></Card></div>
    );

  return (
    <div className="page">
      <PageHeader title="Maintenance optimisation" subtitle={<>{sc.turbineId} · bearing replacement · {num(windows[0].durationH, 0)} h job <SimTag className="ml-1" /></>}
        actions={approval === "pending" ? (<>
          <Button variant="outline" onClick={() => setRej(true)}><ThumbsDown className="h-4 w-4" /> Reject</Button>
          <Button variant="success" disabled={!sel?.eligible} onClick={() => void approve()}><ThumbsUp className="h-4 w-4" /> Approve selected window</Button></>) : null} />

      <WindForecast />
      {approval === "approved" && (
        <div className="flex items-start gap-3 rounded-xl border border-ok/30 bg-ok-soft p-4 text-ok-ink"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm"><b>Plan approved.</b> Technician assigned and notified. {clearanceConfirmed ? "Site safety clearance confirmed by the technician." : "Site safety clearance is still pending — approval does not authorise work to start before it is confirmed on site."}</div></div>
      )}
      {approval === "rejected" && <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm text-warn-ink"><XCircle className="h-5 w-5" /> Plan rejected. Risk monitoring continues; request new windows when ready.<Button size="sm" variant="outline" className="ml-auto" onClick={() => void show()}>Recompute</Button></div>}

      {best && (
        <Card className="border-ok/40 ring-1 ring-ok/20">
          <CardContent className="grid gap-4 pt-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="ok"><Trophy className="h-3 w-3" /> Cheapest eligible window</Badge><Badge variant="outline">Constraints met · clearance pending</Badge></div>
              <p className="text-lg font-semibold">{fmtDate(best.start)}, {fmtTime(best.start)}–{fmtTime(best.end)}</p>
              <p className="text-sm text-muted">Lost revenue {eur(best.lostRevenue)} · wind {num(best.windMs)} m/s · {best.safetyMarginH} h margin before estimated failure · {best.techAvailable} qualified technicians available</p>
            </div>
            <Button variant="outline" onClick={() => select(best.id)}>Select</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><div><CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Window calendar</CardTitle><CardDescription>Next 7 days · select a window · red band marks the estimated failure deadline</CardDescription></div></CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5 overflow-x-auto" role="grid" aria-label="Maintenance window calendar">
              {days.map((d) => {
                const inDay = windows.filter((w) => w.start >= d && w.start < d + DAY).sort((a, b) => a.start - b.start);
                const pastDeadline = deadline !== undefined && d + DAY > deadline;
                return (
                  <div key={d} role="gridcell" className={cn("min-h-[9.5rem] min-w-[5.2rem] rounded-lg border p-1.5", pastDeadline ? "border-crit/40 bg-crit-soft/50" : "border-line bg-slate-50/60")}>
                    <p className="text-[11px] font-semibold">{new Date(d).toLocaleDateString("en-GB", { weekday: "short" })}</p><p className="mb-1 text-[10px] text-muted">{new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</p>
                    <div className="space-y-1">
                      {inDay.map((w) => <WindowChip key={w.id} w={w} selected={w.id === selId} onClick={() => select(w.id)} />)}
                      {pastDeadline && deadline !== undefined && deadline >= d && deadline < d + DAY && <p className="rounded bg-crit px-1 py-0.5 text-center text-[9px] font-bold text-white">Est. failure {fmtTime(deadline)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-ok" />Cheapest eligible</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-accent" />Eligible</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-300" />Not eligible</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Selected window checks</CardTitle><CardDescription>{sel ? `${fmtDateTime(sel.start)} · ${sel.durationH} h` : "Select a window"}</CardDescription></div></CardHeader>
          <CardContent>
            {sel ? (<>
              <ul className="space-y-2">{sel.checks.map((c) => (
                <li key={c.id} className="flex gap-2 text-sm">{c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="Passed" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-crit" aria-label="Failed" />}
                  <div><p className="font-medium leading-tight">{c.label}</p><p className="text-xs text-muted">{c.detail}</p></div></li>))}
                <li className="flex gap-2 text-sm"><ShieldAlert className={cn("mt-0.5 h-4 w-4 shrink-0", clearanceConfirmed ? "text-ok" : "text-warn")} /><div><p className="font-medium leading-tight">Site safety clearance</p><p className="text-xs text-muted">{clearanceConfirmed ? "Confirmed on site" : "Pending — permit-to-work and lock-out/tag-out to be confirmed by the technician. Never assumed safe."}</p></div></li>
              </ul>
              <p className={cn("mt-3 rounded-lg px-3 py-2 text-xs font-medium", sel.eligible ? "bg-primary-50 text-primary" : "bg-crit-soft text-crit-ink")}>{sel.statusLabel}</p>
            </>) : <EmptyState title="Nothing selected" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle>Financial comparison</CardTitle><CardDescription>Lost revenue per window (bars) against safety margin to failure (line). Grey bars are not eligible.</CardDescription></div></CardHeader>
        <CardContent><div className="h-72" role="img" aria-label="Lost revenue and safety margin per window">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke="#EEF2F7" vertical={false} /><XAxis dataKey="label" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-20} dy={10} height={50} />
              <YAxis yAxisId="l" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} /><YAxis yAxisId="r" orientation="right" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit=" h" />
              <Tooltip formatter={(v: number, n) => (n === "Lost revenue" ? eur(v) : `${v} h`)} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="l" dataKey="lost" name="Lost revenue" radius={[6, 6, 0, 0]} isAnimationActive={false} onClick={(d: { id: string }) => select(d.id)} cursor="pointer">
                {chart.map((c) => <Cell key={c.id} fill={c.best ? tokens.ok : c.eligible ? tokens.secondary : "#CBD5E1"} stroke={c.id === selId ? tokens.navy : "none"} strokeWidth={2} />)}</Bar>
              <Line yAxisId="r" dataKey="margin" name="Safety margin" stroke={tokens.warn} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer></div></CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Ranked alternative windows</CardTitle><CardDescription>Eligible windows ranked by lost revenue; ineligible listed last</CardDescription></div></CardHeader>
        <div className="overflow-x-auto"><table className="tbl w-full min-w-[1080px]">
          <thead><tr><th>Rank</th><th>Date &amp; time</th><th>Duration</th><th>Wind</th><th>Weather</th><th>Power forgone</th><th>Price</th><th>Lost revenue</th><th>Failure deadline</th><th>Margin</th><th>Safety status</th><th>Technicians</th></tr></thead>
          <tbody>{ranked.map((w) => (
            <tr key={w.id} onClick={() => select(w.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && select(w.id)} className={cn("cursor-pointer", w.id === selId && "bg-primary-50/60", w.cheapestEligible && "bg-ok-soft/50", !w.eligible && "text-slate-500")}>
              <td>{w.rank ? <Badge variant={w.cheapestEligible ? "ok" : "primary"}>#{w.rank}</Badge> : <Badge>—</Badge>}</td>
              <td className="whitespace-nowrap font-medium">{fmtDate(w.start)} {fmtTime(w.start)}–{fmtTime(w.end)}</td><td>{w.durationH} h</td>
              <td className="tabular-nums"><Wind className="mr-1 inline h-3 w-3" />{num(w.windMs)} m/s</td><td className="text-xs">{w.condition}</td>
              <td className="tabular-nums"><Zap className="mr-1 inline h-3 w-3" />{num(w.expectedMWh)} MWh</td><td className="tabular-nums">€{w.priceEurMWh}/MWh</td>
              <td className="font-semibold tabular-nums">{eur(w.lostRevenue)}</td><td className="whitespace-nowrap text-xs">{fmtDateTime(w.failureDeadline)}</td>
              <td className="tabular-nums">{w.safetyMarginH} h</td>
              <td className="text-xs">{w.eligible ? <span className="text-primary">Constraints met · clearance pending</span> : <span className="text-crit-ink">{w.checks.find((c) => !c.ok)?.label} ✗</span>}</td>
              <td className="text-xs"><Users className="mr-1 inline h-3 w-3" />{w.techAvailable} available</td>
            </tr>))}</tbody></table></div>
      </Card>

      <AiExplain title="Why this recommendation"><p>The engine evaluated {windows.length} windows. The cheapest overall ({eur(Math.min(...windows.map((w) => w.lostRevenue)))}) is {windows.find((w) => w.lostRevenue === Math.min(...windows.map((x) => x.lostRevenue)))?.eligible ? "eligible" : "rejected because it fails a safety constraint"}. Among eligible windows, {best ? `${fmtDate(best.start)} has the lowest expected lost revenue while keeping ${best.safetyMarginH} h before the lower-bound failure date.` : "none satisfies all constraints."} {num(5, 0)} safety checks are applied per window; no window is shown as safe until on-site clearance is confirmed.</p></AiExplain>
      <Sparkles className="hidden" />

      <Dialog open={rej} onOpenChange={setRej}>
        <DialogContent>
          <DialogTitle className="text-base font-semibold">Reject maintenance plan</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted">The engine keeps monitoring risk and can propose alternatives. A reason helps improve future recommendations.</DialogDescription>
          <Textarea className="mt-3" rows={3} aria-label="Rejection reason" placeholder="e.g. Crane not available that day" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRej(false)}>Cancel</Button><Button variant="destructive" onClick={() => { reject(reason); setRej(false); setReason(""); }}>Reject plan</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WindowChip({ w, selected, onClick }: { w: MaintWindow; selected: boolean; onClick: () => void }) {
  const base = w.cheapestEligible ? "bg-ok text-white" : w.eligible ? "bg-accent text-white" : "bg-slate-200 text-slate-600 line-through decoration-slate-400";
  return (
    <button onClick={onClick} aria-pressed={selected} aria-label={`${fmtTime(w.start)} window, ${w.eligible ? "eligible" : "not eligible"}, ${eur(w.lostRevenue)}`}
      className={cn("w-full rounded-md px-1.5 py-1 text-left text-[10px] font-semibold leading-tight transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-navy", base, selected && "ring-2 ring-navy ring-offset-1")}>
      {fmtTime(w.start)}<span className="block font-normal opacity-90">{eur(w.lostRevenue)}</span>{w.cheapestEligible && <span className="block text-[9px] uppercase">Cheapest</span>}
    </button>
  );
}
