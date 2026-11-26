import { useState } from "react";
import { Bell, CalendarClock, ChevronRight, Siren, Truck, UserRound, Wrench } from "lucide-react";
import { useStore, techIdFor } from "@/store/useStore";
import { go } from "@/lib/router";
import { SimTag, EmptyState } from "@/components/common/bits";
import { TransportIcon } from "@/components/common/maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TECHNICIANS, dayStart } from "@/engine/fleet";
import { cn, fmtDate, fmtTime, relTime } from "@/lib/utils";

const DAY = 86400000;
const UPCOMING: Record<string, { id: string; turbine: string; action: string; at: number; priority: string }[]> = {
  "T-01": [{ id: "UT-1", turbine: "WT-11", action: "Routine borescope inspection", at: 1.4, priority: "Normal" }, { id: "UT-2", turbine: "WT-16", action: "Lubrication system check", at: 3.4, priority: "Normal" }],
  "T-02": [{ id: "UT-3", turbine: "WT-09", action: "Vibration verification", at: 1.4, priority: "Low" }],
  "T-03": [{ id: "UT-4", turbine: "WT-21", action: "Post-replacement follow-up", at: 3.4, priority: "Normal" }],
  "T-04": [{ id: "UT-5", turbine: "WT-02", action: "Grease-point service", at: 1.4, priority: "Normal" }],
  "T-05": [{ id: "UT-6", turbine: "WT-24", action: "Rope-access blade check", at: 4.4, priority: "Low" }],
  "T-06": [],
};

export default function TechHome() {
  const s = useStore();
  const id = techIdFor(s);
  const tech = TECHNICIANS.find((t) => t.id === id)!;
  const a = s.assignment && s.assignment.techId === id ? s.assignment : null;
  const [avail, setAvail] = useState<"available" | "busy" | "off">("available");
  const notices = s.notices.filter((n) => n.roles.includes("technician")).slice(0, 4);
  const upcoming = UPCOMING[id] ?? [];
  const emergency = a?.kind === "emergency" && a.status !== "completed";
  const effective = a && a.status !== "completed" ? "busy" : avail;
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-semibold text-white">{tech.name.split(" ").map((x) => x[0]).join("")}</span>
        <div className="min-w-0 flex-1"><p className="text-lg font-semibold leading-tight">Hi, {tech.name.split(" ")[0]}</p><p className="text-xs text-muted">Demo technician profile · only your assignments are shown</p></div>
        <SimTag />
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Availability</p>
            <Badge variant={effective === "available" ? "ok" : effective === "busy" ? "warn" : "default"}>{effective === "available" ? "Available" : effective === "busy" ? "On assignment" : "Off shift"}</Badge></div>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Set availability">
            {([["available", "Available"], ["busy", "Busy"], ["off", "Off shift"]] as const).map(([k, l]) => (
              <button key={k} disabled={!!a && a.status !== "completed"} onClick={() => { setAvail(k); s.toast({ tone: "info", title: `Status set to ${l}` }); }} aria-pressed={effective === k || avail === k && !a}
                className={cn("rounded-lg border px-2 py-2 text-xs font-medium transition disabled:opacity-60", avail === k && !a ? "border-primary bg-primary-50 text-primary" : "border-line bg-white")}>{l}</button>))}
          </div>
          <p className="flex items-center gap-2 text-xs text-muted"><TransportIcon t={tech.transport} /> Current transport: <b className="text-navy">{tech.transport}</b> · {tech.base}</p>
        </CardContent>
      </Card>

      {a && a.status !== "completed" ? (
        <button onClick={() => go("#/tech/task")} className={cn("w-full rounded-xl border p-4 text-left shadow-card transition active:scale-[0.99]", emergency ? "border-crit bg-crit text-white" : "border-primary/30 bg-white")}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">{emergency ? <Siren className="h-4 w-4" /> : <Wrench className="h-4 w-4 text-primary" />}{emergency ? "Emergency assignment" : "Current assignment"}</div>
          <p className="mt-1 text-xl font-semibold">{a.turbineId} · bearing replacement</p>
          <p className={cn("text-sm", emergency ? "text-white/80" : "text-muted")}>Status: {a.status.replace("_", " ")} · ETA {a.etaMin} min</p>
          <p className={cn("mt-2 inline-flex items-center gap-1 text-sm font-semibold", emergency ? "text-white" : "text-primary")}>{a.status === "offered" ? "Respond now" : "Open task"} <ChevronRight className="h-4 w-4" /></p>
        </button>
      ) : (
        <Card><EmptyState title={a?.status === "completed" ? "Task completed — thank you" : "No current assignment"} body={a?.status === "completed" ? "Your completion notes were submitted. The senior and executive dashboards are updated." : "New assignments from the engine will appear here instantly."} /></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> Upcoming tasks</CardTitle></CardHeader>
        <CardContent>{upcoming.length === 0 ? <p className="py-3 text-sm text-muted">Nothing scheduled.</p> : (
          <ul className="divide-y divide-line">{upcoming.map((u) => <li key={u.id} className="flex items-center gap-3 py-2.5"><Truck className="h-4 w-4 text-muted" /><div className="min-w-0 flex-1"><p className="text-sm font-medium leading-tight">{u.turbine} · {u.action}</p><p className="text-xs text-muted">{fmtDate(dayStart() + u.at * DAY)} {fmtTime(dayStart() + u.at * DAY)}</p></div><Badge>{u.priority}</Badge></li>)}</ul>)}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</CardTitle></CardHeader>
        <CardContent>{notices.length === 0 ? <p className="py-3 text-sm text-muted">No new notifications.</p> : <ul className="space-y-2">{notices.map((n) => <li key={n.id} className="rounded-lg bg-slate-50 p-3"><p className="text-sm font-semibold leading-tight">{n.title}</p><p className="text-xs text-muted">{n.body} · {relTime(n.ts)}</p></li>)}</ul>}</CardContent>
      </Card>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted"><UserRound className="h-3 w-3" /> Demo view — role switcher is not authentication.</p>
      <Button variant="ghost" size="sm" className="mx-auto hidden" />
    </div>
  );
}
