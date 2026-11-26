import { useState } from "react";
import { Award, Clock, MapPin, Phone, Star, UserCheck, UserX } from "lucide-react";
import { useStore } from "@/store/useStore";
import { AiExplain, EmptyState, PageHeader, SimTag } from "@/components/common/bits";
import { TransportIcon, WindFarmMap } from "@/components/common/maps";
import { CallStatusCard } from "@/components/common/call";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/misc";
import { TECHNICIANS } from "@/engine/fleet";
import { etaMinutes } from "@/engine/dispatch";
import { cn, fmtTime } from "@/lib/utils";
import type { AssignStatus } from "@/types";

const steps: AssignStatus[] = ["offered", "accepted", "travelling", "arrived", "cleared", "in_progress", "completed"];
const label: Record<AssignStatus, string> = { offered: "Offered", accepted: "Accepted", travelling: "Travelling", arrived: "Arrived", cleared: "Safety cleared", in_progress: "Maintenance", completed: "Completed", declined: "Declined" };

export default function Technicians() {
  const fleet = useStore((s) => s.fleet);
  const cands = useStore((s) => s.candidates);
  const note = useStore((s) => s.selectionNote);
  const a = useStore((s) => s.assignment);
  const call = useStore((s) => s.call);
  const sc = useStore((s) => s.scenario);
  const [open, setOpen] = useState<string | null>(null);
  const focus = sc.turbineId ?? "WT-07";
  const det = TECHNICIANS.find((t) => t.id === open);
  const statusFor = (id: string) => {
    if (a?.techId === id && a.status !== "completed") return { v: "primary" as const, t: `Assigned · ${label[a.status]}` };
    const t = TECHNICIANS.find((x) => x.id === id)!;
    if (t.status === "off_shift") return { v: "default" as const, t: "Off shift" };
    return { v: "ok" as const, t: "Available" };
  };
  const idx = a ? steps.indexOf(a.status) : -1;
  return (
    <div className="page">
      <PageHeader title="Technician management" subtitle={<>Availability, qualifications and engine selection <SimTag className="ml-1" /></>} />

      {call && (
        <Card className={cn(call.status === "escalated" && "border-crit/40")}>
          <CardHeader><div><CardTitle>Emergency call status</CardTitle><CardDescription>{call.status === "escalated" ? "Automated dispatch stopped — manual control required" : "Live incident dispatch (simulated)"}</CardDescription></div></CardHeader>
          <CardContent><CallStatusCard call={call} /></CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader><div><CardTitle>Technician locations</CardTitle><CardDescription>Purple squares are technicians; the dashed line shows an active dispatch</CardDescription></div></CardHeader>
          <CardContent><WindFarmMap fleet={fleet} techs={TECHNICIANS} selectedId={focus} height={340} route={a ? { techId: a.techId, turbineId: a.turbineId } : null} /></CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><div><CardTitle>Assignment &amp; acceptance</CardTitle><CardDescription>{a ? `${a.turbineId} · ${a.kind}` : "No active assignment"}</CardDescription></div></CardHeader>
          <CardContent>
            {!a ? <EmptyState title="Nothing assigned" body="The engine assigns a technician after a plan is approved or an emergency is initiated." /> : (
              <div>
                <p className="mb-3 text-sm"><b>{TECHNICIANS.find((t) => t.id === a.techId)?.name}</b> · ETA {a.etaMin} min · <Badge variant={a.kind === "emergency" ? "crit" : "primary"}>{a.kind}</Badge></p>
                <ol className="space-y-2">{steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-2.5 text-sm"><span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold", i < idx ? "bg-ok text-white" : i === idx ? "bg-primary text-white ring-4 ring-primary/20" : "bg-slate-100 text-slate-400")}>{i < idx ? "✓" : i + 1}</span>
                    <span className={cn(i <= idx ? "font-medium" : "text-muted")}>{label[s]}</span>{a.history.find((h) => h.status === s) && <span className="ml-auto text-xs text-muted">{fmtTime(a.history.find((h) => h.status === s)!.ts)}</span>}</li>))}</ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {cands.length > 0 && <AiExplain title="Why this technician was selected"><p>{note}</p></AiExplain>}

      <Card>
        <CardHeader><div><CardTitle>{cands.length ? "Candidate ranking" : "Technician roster"}</CardTitle><CardDescription>{cands.length ? `For ${focus} · ${sc.kind === "red" ? "ranked by response time (emergency)" : "qualification gate, then travel time, workload and rating"}` : `ETAs shown for ${focus}`}</CardDescription></div></CardHeader>
        <div className="overflow-x-auto"><table className="tbl w-full min-w-[900px]">
          <thead><tr><th>#</th><th>Technician</th><th>Status</th><th>Transport</th><th>ETA</th><th>Qualifications</th><th>Current assignment</th><th>Why</th></tr></thead>
          <tbody>
            {(cands.length ? cands.map((c, i) => ({ t: c.tech, c, i })) : TECHNICIANS.map((t, i) => ({ t, c: null, i }))).map(({ t, c, i }) => {
              const st = statusFor(t.id);
              const chosen = a?.techId === t.id;
              return (
                <tr key={t.id} className={cn("cursor-pointer", chosen && "bg-primary-50/60", c && !c.qualified && "opacity-60")} tabIndex={0} onClick={() => setOpen(t.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(t.id)}>
                  <td>{c ? (c.qualified ? <Badge variant={i === 0 ? "ok" : "primary"}>#{i + 1}</Badge> : <UserX className="h-4 w-4 text-crit" aria-label="Excluded" />) : "—"}</td>
                  <td><p className="font-semibold">{t.name}</p><p className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" />{t.base}</p></td>
                  <td><Badge variant={st.v}>{st.t}</Badge></td>
                  <td className="text-xs"><TransportIcon t={t.transport} className="mr-1 inline" />{t.transport}</td>
                  <td className="tabular-nums"><Clock className="mr-1 inline h-3 w-3 text-muted" />{c ? c.etaMin : etaMinutes(t, focus)} min</td>
                  <td className="text-xs">{t.certs.length} certs · <Star className="inline h-3 w-3 text-warn" /> {t.rating}</td>
                  <td className="text-xs">{chosen ? `${a?.turbineId} (${label[a!.status]})` : "—"}</td>
                  <td className="max-w-[18rem] text-xs text-muted">{c ? (c.qualified ? c.reasons[1] : c.excluded) : "Open profile"}</td>
                </tr>);
            })}
          </tbody></table></div>
      </Card>

      <Dialog open={!!det} onOpenChange={(o) => !o && setOpen(null)}>
        {det && (
          <DialogContent>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold"><UserCheck className="h-4 w-4 text-primary" />{det.name}</DialogTitle>
            <DialogDescription className="text-xs text-muted">{det.base} · {det.transport} · {det.speedKmh} km/h avg · <Phone className="inline h-3 w-3" /> {det.phone} (simulated)</DialogDescription>
            <div className="mt-4 space-y-3 text-sm">
              <div><p className="mb-1 text-xs font-semibold text-muted">Skills</p><div className="flex flex-wrap gap-1.5">{det.skills.map((s) => <Badge key={s} variant="primary">{s}</Badge>)}</div></div>
              <div><p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted"><Award className="h-3.5 w-3.5" />Certifications</p><div className="flex flex-wrap gap-1.5">{det.certs.map((s) => <Badge key={s} variant="ok">{s}</Badge>)}</div></div>
              <div><p className="mb-1 text-xs font-semibold text-muted">Equipment</p><div className="flex flex-wrap gap-1.5">{det.equipment.map((s) => <Badge key={s}>{s}</Badge>)}</div></div>
              <p className="text-xs text-muted">Weekly workload {det.workloadH} h · {det.onCall ? "On emergency call rota" : "Not on emergency rota"}</p>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
