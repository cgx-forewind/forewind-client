import { useState } from "react";
import { AlertTriangle, CheckCircle2, Compass, MapPin, Navigation, Package, ShieldCheck, Wind, XCircle, Siren } from "lucide-react";
import { useStore, techIdFor } from "@/store/useStore";
import { go } from "@/lib/router";
import { AiExplain, EmptyState, SimTag } from "@/components/common/bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, Textarea } from "@/components/ui/misc";
import { REQUIRED_CERTS, REQUIRED_EQUIPMENT, TECHNICIANS, turbineById } from "@/engine/fleet";
import { cn, fmtDateTime, num } from "@/lib/utils";
import type { AssignStatus } from "@/types";

const FLOW: { s: AssignStatus; label: string }[] = [{ s: "accepted", label: "Accepted" }, { s: "travelling", label: "Travelling" }, { s: "arrived", label: "Arrived" }, { s: "cleared", label: "Cleared" }, { s: "in_progress", label: "Working" }, { s: "completed", label: "Done" }];
const CHECKS = ["Permit-to-work issued and signed by the control room", "Turbine locked out / tagged out and rotor lock engaged", "Wind at nacelle height confirmed ≤ 12 m/s", "Fall-protection and rescue plan briefed to the crew"];
const DECLINE = ["Not available / already committed", "Feeling unwell or fatigued", "Vehicle or equipment problem", "Not comfortable with weather conditions", "Other"];

export default function TechTask() {
  const s = useStore();
  const id = techIdFor(s);
  const a = s.assignment && s.assignment.techId === id ? s.assignment : null;
  const [decline, setDecline] = useState(false);
  const [reason, setReason] = useState(DECLINE[0]);
  const [finish, setFinish] = useState(false);
  const [notes, setNotes] = useState("");
  const [findings, setFindings] = useState("");
  const [nav, setNav] = useState(false);
  if (!a) return <div className="p-4"><Card><EmptyState title="No task assigned" body="When the engine assigns you a task, the details appear here." action={<Button size="sm" onClick={() => go("#/tech/home")}>Back to home</Button>} /></Card></div>;

  const tb = turbineById(a.turbineId)!;
  const win = s.windows.find((w) => w.id === a.windowId);
  const emergency = a.kind === "emergency";
  const tech = TECHNICIANS.find((t) => t.id === a.techId)!;
  const idx = FLOW.findIndex((f) => f.s === a.status);
  const allChecked = s.clearanceItems.every(Boolean);
  const wind = win ? win.windMs : 9.4;
  const cond = win ? win.condition : "Overcast, gusty";
  const assigned = win ? fmtDateTime(win.start) : "Immediate (emergency)";
  const done = a.status === "completed";

  const primary = (() => {
    switch (a.status) {
      case "offered": return (
        <div className="grid grid-cols-2 gap-3"><Button size="lg" variant="outline" onClick={() => setDecline(true)}><XCircle className="h-5 w-5" /> Decline</Button><Button size="lg" variant="success" onClick={s.acceptAssignment}><CheckCircle2 className="h-5 w-5" /> Accept</Button></div>);
      case "accepted": return <Button size="lg" className="w-full" onClick={() => s.advance("travelling")}><Navigation className="h-5 w-5" /> Mark as travelling</Button>;
      case "travelling": return <Button size="lg" className="w-full" onClick={() => s.advance("arrived")}><MapPin className="h-5 w-5" /> Mark as arrived</Button>;
      case "arrived": return <Button size="lg" variant="success" className="w-full" disabled={!allChecked} onClick={() => s.advance("cleared")}><ShieldCheck className="h-5 w-5" /> Confirm safety clearance</Button>;
      case "cleared": return <Button size="lg" className="w-full" onClick={() => s.advance("in_progress")}><CheckCircle2 className="h-5 w-5" /> Start maintenance</Button>;
      case "in_progress": return <Button size="lg" variant="success" className="w-full" onClick={() => setFinish(true)}><CheckCircle2 className="h-5 w-5" /> Complete maintenance</Button>;
      default: return null;
    }
  })();

  return (
    <div className="space-y-4 p-4">
      <div className={cn("rounded-xl p-4 text-white shadow-card", emergency ? "bg-crit" : "bg-primary")}>
        <div className="flex items-center justify-between"><Badge className="bg-white/20 text-white">{emergency ? <><Siren className="h-3 w-3" /> EMERGENCY</> : "Planned"}</Badge><SimTag className="border-white/40 text-white/80" /></div>
        <h1 className="mt-2 text-2xl font-semibold">{a.turbineId}</h1>
        <p className="text-sm text-white/85">{a.action}</p>
        <p className="mt-1 text-xs text-white/75">{tb.site} · {tb.model} · Priority: {emergency ? "Critical" : "Normal"}</p>
      </div>

      {emergency && !done && <div className="flex gap-2 rounded-xl border border-crit/30 bg-crit-soft p-3 text-sm text-crit-ink"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p><b>Emergency dispatch does not authorise unsafe work.</b> Permit-to-work and safety clearance are still mandatory.</p></div>}

      {/* progress */}
      <Card><CardContent className="pt-4">
        <ol className="flex items-center" aria-label="Task progress">
          {FLOW.map((f, i) => (
            <li key={f.s} className="flex flex-1 flex-col items-center gap-1 text-center">
              <div className="flex w-full items-center"><span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= idx ? "bg-ok" : "bg-slate-200")} />
                <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold", i < idx || done ? "bg-ok text-white" : i === idx ? "bg-primary text-white ring-4 ring-primary/20" : "bg-slate-100 text-slate-400")}>{i < idx || done ? "✓" : i + 1}</span>
                <span className={cn("h-0.5 flex-1", i === FLOW.length - 1 ? "bg-transparent" : i < idx ? "bg-ok" : "bg-slate-200")} /></div>
              <span className={cn("text-[10px] font-medium", i === idx ? "text-primary" : "text-muted")}>{f.label}</span>
            </li>))}
        </ol>
        <p className="mt-3 text-center text-sm font-medium">{a.status === "offered" ? "Waiting for your response" : done ? "Maintenance completed" : `Current step: ${a.status.replace("_", " ")}`}</p>
      </CardContent></Card>

      {a.status === "arrived" && (
        <Card><CardHeader><CardTitle>Safety clearance checklist</CardTitle></CardHeader><CardContent className="space-y-2">
          {CHECKS.map((c, i) => (
            <label key={c} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition", s.clearanceItems[i] ? "border-ok bg-ok-soft/50" : "border-line")}>
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#16A34A]" checked={s.clearanceItems[i]} onChange={(e) => s.setClearance(i, e.target.checked)} /><span>{c}</span></label>))}
          <p className="text-xs text-muted">“Start maintenance” stays locked until every item is confirmed on site.</p>
        </CardContent></Card>
      )}

      {!done && <div className="sticky bottom-[4.25rem] z-20 rounded-2xl bg-surface/90 py-1 backdrop-blur">{primary}</div>}

      {done && <Card className="border-ok/40 bg-ok-soft/40"><CardContent className="pt-4 text-sm"><p className="font-semibold text-ok-ink">Completion submitted</p><p className="mt-1 text-slate-700">{a.completionNotes}</p><p className="mt-1 text-xs text-muted">Findings: {a.findings}</p></CardContent></Card>}

      <Card><CardHeader><CardTitle>Task details</CardTitle></CardHeader>
        <CardContent><dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-xs text-muted">Assigned time</dt><dd className="font-medium">{assigned}</dd></div>
          <div><dt className="text-xs text-muted">Estimated travel</dt><dd className="font-medium">{a.etaMin} min · {tech.transport}</dd></div>
          <div><dt className="text-xs text-muted">Location</dt><dd className="font-medium">{tb.site} (schematic {num(tb.x, 0)}, {num(tb.y, 0)})</dd></div>
          <div><dt className="text-xs text-muted">Weather</dt><dd className="font-medium"><Wind className="mr-1 inline h-3.5 w-3.5" />{num(wind)} m/s · {cond}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-muted">Required action</dt><dd className="font-medium">{a.action}</dd></div></dl></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-ok" /> Safety instructions</CardTitle></CardHeader>
        <CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm"><li>Do <b>not</b> climb or open the nacelle before permit-to-work and lock-out/tag-out are confirmed.</li><li>Stop work and descend if wind exceeds 12 m/s or lightning is within 10 km.</li><li>Two-person rule for all work at height; confirm rescue plan.</li><li>Report any unexpected findings to the control room before continuing.</li></ul></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Qualifications &amp; equipment</CardTitle></CardHeader>
        <CardContent className="space-y-2"><div className="flex flex-wrap gap-1.5">{REQUIRED_CERTS.map((c) => <Badge key={c} variant={tech.certs.includes(c) ? "ok" : "crit"}>{tech.certs.includes(c) ? "✓" : "✗"} {c}</Badge>)}</div>
          <div className="flex flex-wrap gap-1.5">{REQUIRED_EQUIPMENT.map((c) => <Badge key={c}>{c}</Badge>)}<Badge>Replacement bearing set (staged)</Badge></div></CardContent></Card>

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Compass className="h-4 w-4 text-primary" /> Navigation</CardTitle></CardHeader>
        <CardContent>
          <div className="relative h-36 overflow-hidden rounded-xl bg-gradient-to-br from-[#F1F6FC] to-[#E1ECF8]">
            <svg viewBox="0 0 100 40" className="h-full w-full" aria-label="Route preview"><path d="M8 32 C 25 30, 30 12, 52 16 S 80 10, 92 8" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeDasharray={nav ? "0" : "3 2"} /><circle cx="8" cy="32" r="2.4" fill="#7C3AED" /><circle cx="92" cy="8" r="3" fill="#fff" stroke={emergency ? "#DC2626" : "#0057B8"} strokeWidth="1.4" /></svg>
            <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-muted">Simulated route</span>
          </div>
          <Button variant="outline" className="mt-3 w-full" onClick={() => { setNav((n) => !n); s.toast({ tone: "info", title: nav ? "Navigation stopped" : "Navigation started (simulated)", body: nav ? undefined : `${a.etaMin} min to ${a.turbineId}` }); }}><Navigation className="h-4 w-4" />{nav ? "Stop navigation" : "Start navigation"}</Button>
          {nav && <ol className="mt-3 space-y-1.5 text-sm"><li>1. Leave {tech.base} via service road</li><li>2. Continue 7 km on ridge track</li><li>3. Arrive at {a.turbineId} access pad</li></ol>}
        </CardContent></Card>

      <AiExplain title="Why you, and why now">
        <p>{emergency ? `${a.turbineId} shows critical bearing risk. You were the nearest qualified, on-call technician (ETA ${a.etaMin} min).` : `${a.turbineId} shows early bearing wear. The engine chose a low-wind window to keep lost production small and picked you for proximity, workload and qualifications.`}</p>
        <p>{emergency ? "Your job is to inspect and stabilise the turbine safely; the engine will not push you to start before clearance." : "Replacing the bearing now avoids an unplanned failure that would cost far more and cause weeks of downtime."}</p>
      </AiExplain>

      <Dialog open={decline} onOpenChange={setDecline}><DialogContent>
        <DialogTitle className="text-base font-semibold">Decline assignment</DialogTitle><DialogDescription className="text-sm text-muted">Pick a reason — the engine will re-offer the task to the next qualified technician.</DialogDescription>
        <div className="mt-3 space-y-1.5">{DECLINE.map((d) => <label key={d} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm", reason === d ? "border-primary bg-primary-50" : "border-line")}><input type="radio" name="dr" checked={reason === d} onChange={() => setReason(d)} className="accent-[#0057B8]" />{d}</label>)}</div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setDecline(false)}>Cancel</Button><Button variant="destructive" onClick={() => { s.declineAssignment(reason); setDecline(false); }}>Decline task</Button></div>
      </DialogContent></Dialog>

      <Dialog open={finish} onOpenChange={setFinish}><DialogContent>
        <DialogTitle className="text-base font-semibold">Complete maintenance</DialogTitle><DialogDescription className="text-sm text-muted">Submit your notes and inspection findings.</DialogDescription>
        <label htmlFor="cn" className="mt-3 block text-xs font-medium text-muted">Completion notes</label><Textarea id="cn" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work performed, parts replaced, torque values…" />
        <label htmlFor="fi" className="mt-3 block text-xs font-medium text-muted">Inspection findings</label><Textarea id="fi" rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Condition of removed bearing, any secondary damage…" />
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setFinish(false)}>Cancel</Button>
          <Button variant="success" disabled={notes.trim().length < 3 || findings.trim().length < 3} onClick={() => { s.submitCompletion(notes, findings); setFinish(false); }}>Submit &amp; finish</Button></div>
      </DialogContent></Dialog>
    </div>
  );
}
