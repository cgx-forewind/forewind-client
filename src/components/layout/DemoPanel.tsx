import { useRef, useState } from "react";
import { PlayCircle, X, Play, RotateCcw, Flame, TriangleAlert, CalendarCheck, ThumbsUp, Truck, Phone, CheckCircle2, Landmark, Activity, WifiOff, Wand2, Square } from "lucide-react";
import { useStore, roleHome } from "@/store/useStore";
import { go } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState<null | "yellow" | "red">(null);
  const stop = useRef(false);
  const s = useStore();
  const phase = `${s.scenario.kind === "none" ? "Normal operation" : s.scenario.kind === "yellow" ? "Yellow scenario" : "Red scenario"}${s.scenario.turbineId ? ` · ${s.scenario.turbineId}` : ""} · ${s.scenario.phase}`;

  const run = async (kind: "yellow" | "red") => {
    stop.current = false;
    setAuto(kind);
    const st = useStore.getState();
    const step = async (fn: () => unknown | Promise<unknown>, ms: number) => {
      if (stop.current) return false;
      await fn();
      await sleep(ms);
      return !stop.current;
    };
    if (kind === "yellow") {
      go(roleHome.senior); st.setRole("senior");
      (await step(() => st.startNormal(), 1500)) &&
        (await step(() => st.simulateDegradation(), 5200)) &&
        (await step(() => st.triggerYellow(), 2500)) &&
        (await step(() => st.showWindows(), 3200)) &&
        (await step(() => { go("#/senior/optimization"); }, 3000)) &&
        (await step(() => st.approvePlan(), 2500)) &&
        (await step(() => { st.setRole("technician"); go("#/tech/task"); st.simulateDispatch(); }, 3200)) &&
        (await step(() => { st.setRole("senior"); go("#/senior/engine"); st.completeMaintenance(); }, 2800)) &&
        (await step(() => { st.setRole("executive"); go("#/exec/financial"); }, 0));
    } else {
      st.setRole("senior"); go("#/senior/engine");
      (await step(() => st.startNormal(), 1200)) &&
        (await step(() => st.triggerRed(), 2500)) &&
        (await step(() => { st.setRole("technician"); go("#/tech/home"); st.simulateEmergencyCalls("decline_then_accept"); }, 7500)) &&
        (await step(() => { st.setRole("senior"); go("#/senior/engine"); }, 3000)) &&
        (await step(() => st.completeMaintenance(), 2500)) &&
        (await step(() => { st.setRole("executive"); go("#/exec/dashboard"); }, 0));
    }
    setAuto(null);
  };

  const Step = ({ n, icon, label, onClick, tone = "default" }: { n: number; icon: React.ReactNode; label: string; onClick: () => void; tone?: "default" | "warn" | "crit" }) => (
    <button onClick={onClick} disabled={!!auto} className={cn("flex w-full items-center gap-2.5 rounded-lg border border-line bg-white px-2.5 py-2 text-left text-sm transition hover:border-primary hover:bg-primary-50 disabled:opacity-50", tone === "crit" && "hover:border-crit hover:bg-crit-soft", tone === "warn" && "hover:border-warn hover:bg-warn-soft")}>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{n}</span>
      <span className="text-muted">{icon}</span><span className="font-medium">{label}</span>
    </button>
  );

  if (!open)
    return (
      <button onClick={() => setOpen(true)} aria-label="Open demo controls" className="no-print fixed bottom-[4.75rem] left-3 z-40 flex h-10 items-center gap-2 rounded-full bg-navy px-4 text-xs font-semibold text-white shadow-pop transition hover:bg-slate-800 sm:bottom-4 sm:left-4">
        <PlayCircle className="h-4 w-4" /> Demo mode
      </button>
    );
  return (
    <section aria-label="Demo controls" className="no-print fixed bottom-[4.75rem] left-3 z-40 flex max-h-[78vh] w-[min(92vw,21rem)] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-pop animate-slideUp sm:bottom-4 sm:left-4">
      <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
        <div><p className="text-sm font-semibold">Interactive demo</p><p className="text-[11px] text-white/60">Shared state across all roles</p></div>
        <button onClick={() => setOpen(false)} aria-label="Close demo controls" className="rounded-md p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-3 overflow-y-auto p-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="text-muted">Now: </span><b>{phase}</b></div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="ai" disabled={!!auto} onClick={() => void run("yellow")}><Wand2 className="h-3.5 w-3.5" /> Auto: yellow</Button>
          <Button size="sm" variant="ai" disabled={!!auto} onClick={() => void run("red")}><Wand2 className="h-3.5 w-3.5" /> Auto: red</Button>
        </div>
        {auto && <Button size="sm" variant="outline" className="w-full" onClick={() => { stop.current = true; setAuto(null); }}><Square className="h-3 w-3" /> Stop auto-run</Button>}
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Normal workflow (yellow)</p>
        <div className="space-y-1.5">
          <Step n={1} icon={<Play className="h-3.5 w-3.5" />} label="Start normal operation" onClick={s.startNormal} />
          <Step n={2} icon={<Activity className="h-3.5 w-3.5" />} label="Simulate gradual degradation" onClick={s.simulateDegradation} />
          <Step n={3} icon={<TriangleAlert className="h-3.5 w-3.5 text-warn" />} label="Trigger yellow alert" tone="warn" onClick={() => void s.triggerYellow()} />
          <Step n={4} icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Display optimized windows" onClick={() => void s.showWindows()} />
          <Step n={5} icon={<ThumbsUp className="h-3.5 w-3.5" />} label="Approve maintenance" onClick={() => void s.approvePlan()} />
          <Step n={6} icon={<Truck className="h-3.5 w-3.5" />} label="Simulate technician dispatch" onClick={s.simulateDispatch} />
        </div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Emergency workflow (red)</p>
        <div className="space-y-1.5">
          <Step n={7} icon={<Flame className="h-3.5 w-3.5 text-crit" />} label="Trigger red alert" tone="crit" onClick={() => void s.triggerRed()} />
          <div className="rounded-lg border border-line p-2">
            <p className="mb-1.5 flex items-center gap-2 text-sm font-medium"><span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">8</span><Phone className="h-3.5 w-3.5 text-muted" />Simulate emergency calls</p>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant="outline" disabled={!!auto} onClick={() => s.simulateEmergencyCalls("accept")}>Accept</Button>
              <Button size="sm" variant="outline" disabled={!!auto} onClick={() => s.simulateEmergencyCalls("decline_then_accept")}>Decline→2nd</Button>
              <Button size="sm" variant="outline" disabled={!!auto} onClick={() => s.simulateEmergencyCalls("no_response")}>No reply</Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted">Or answer the call yourself in the Technician view.</p>
          </div>
        </div>
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Wrap-up</p>
        <div className="space-y-1.5">
          <Step n={9} icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Complete maintenance" onClick={s.completeMaintenance} />
          <Step n={10} icon={<Landmark className="h-3.5 w-3.5" />} label="Show updated executive financials" onClick={() => { s.setRole("executive"); go("#/exec/financial"); }} />
          <Step n={11} icon={<RotateCcw className="h-3.5 w-3.5" />} label="Reset demonstration" onClick={() => { stop.current = true; setAuto(null); s.reset(); }} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
          <label htmlFor="off" className="flex items-center gap-2 text-sm"><WifiOff className="h-4 w-4 text-muted" />Simulate offline</label>
          <Switch id="off" checked={s.offline} onCheckedChange={s.setOffline} aria-label="Simulate offline mode" />
        </div>
        <p className="text-[10px] leading-snug text-muted">All predictions, calls and financial figures are <Badge variant="outline">simulated</Badge> and not verified SKF data.</p>
      </div>
    </section>
  );
}
