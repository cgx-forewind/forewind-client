import { create } from "zustand";
import type {
  Assignment, AssignStatus, CallLine, CallState, Candidate, ChatMessage, EngineEvent, Job, MaintStatus, MaintWindow,
  Notice, Prediction, Role, Toast, TurbineStatus, TurbineView,
} from "@/types";
import { api, setApiOffline } from "@/services/api";
import { FLEET, FOCUS_RED, FOCUS_YELLOW, TECHNICIANS, turbineById } from "@/engine/fleet";
import { buildTurbineView, degToRul, predict } from "@/engine/telemetry";
import { summarize, type FinanceSummary, PLANNED_JOB_COST, EMERGENCY_JOB_COST, REACTIVE_FAILURE_COST } from "@/engine/finance";
import { SUGGESTIONS, type AssistantCtx } from "@/engine/assistant";
import { eur, fmtDateTime, uid } from "@/lib/utils";

export type Phase = "idle" | "degrading" | "alert" | "proposed" | "approved" | "assigned" | "underway" | "completed" | "escalated" | "calling";
export const YELLOW_D = 0.6;
export const RED_D = 0.92;

const baseDeg = () => Object.fromEntries(FLEET.map((t) => [t.id, t.baseDegradation])) as Record<string, number>;

interface State {
  role: Role;
  offline: boolean;
  lastSync: number;
  scenario: { kind: "none" | "yellow" | "red"; turbineId: string | null; phase: Phase };
  deg: Record<string, number>;
  events: EngineEvent[];
  windows: MaintWindow[];
  selectedWindowId: string | null;
  approval: "none" | "pending" | "approved" | "rejected";
  candidates: Candidate[];
  selectionNote: string;
  candidateIdx: number;
  assignment: Assignment | null;
  call: CallState | null;
  notices: Notice[];
  jobs: Job[];
  toasts: Toast[];
  chats: Record<Role, ChatMessage[]>;
  chatBusy: boolean;
  assistantOpen: boolean;
  clearanceItems: boolean[];
  // derived (kept in state so every role view reads the same snapshot)
  fleet: TurbineView[];
  prediction: Record<string, Prediction>;
  fin: FinanceSummary;

  setRole: (r: Role) => void;
  setOffline: (v: boolean) => void;
  toggleAssistant: (v?: boolean) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  markAllRead: (role: Role) => void;
  markRead: (id: string) => void;

  reset: () => void;
  startNormal: () => void;
  simulateDegradation: () => void;
  triggerYellow: () => Promise<void>;
  showWindows: () => Promise<void>;
  selectWindow: (id: string) => void;
  approvePlan: () => Promise<void>;
  rejectPlan: (reason?: string) => void;
  simulateDispatch: () => void;
  triggerRed: () => Promise<void>;
  simulateEmergencyCalls: (mode: "accept" | "decline_then_accept" | "no_response") => void;
  callRespond: (a: "accept" | "decline" | "timeout") => void;
  completeMaintenance: () => void;

  acceptAssignment: () => void;
  declineAssignment: (reason: string) => void;
  advance: (s: AssignStatus) => void;
  setClearance: (i: number, v: boolean) => void;
  submitCompletion: (notes: string, findings: string) => void;
  sendChat: (role: Role, text: string) => Promise<void>;
}

let degTimer: ReturnType<typeof setInterval> | null = null;
let autoTimers: ReturnType<typeof setTimeout>[] = [];
const clearAuto = () => {
  autoTimers.forEach(clearTimeout);
  autoTimers = [];
  if (degTimer) clearInterval(degTimer);
  degTimer = null;
};

const intro = (): ChatMessage[] => [];

function computeDerived(s: Pick<State, "deg" | "jobs" | "scenario" | "assignment" | "approval" | "offline">) {
  const status: Record<string, TurbineStatus> = {};
  const maint: Record<string, MaintStatus> = {};
  const a = s.assignment;
  const focus = s.scenario.turbineId;
  if (focus && s.scenario.kind !== "none") {
    if (s.scenario.phase === "proposed" && s.approval === "pending") maint[focus] = "awaiting_approval";
    if (s.scenario.phase === "approved") maint[focus] = "scheduled";
    if (s.scenario.phase === "assigned") maint[focus] = s.scenario.kind === "red" ? "emergency" : "dispatching";
    if (s.scenario.phase === "calling" || s.scenario.phase === "alert" && s.scenario.kind === "red") maint[focus] = "emergency";
    if (a && (a.status === "in_progress" || a.status === "cleared")) {
      maint[focus] = "in_progress";
      if (a.status === "in_progress") status[focus] = "maintenance";
    }
    if (s.scenario.phase === "underway") maint[focus] = a?.status === "in_progress" ? "in_progress" : maint[focus] ?? "dispatching";
  }
  const fleet = FLEET.map((t) => buildTurbineView(t, s.deg[t.id], { status, maint }));
  const prediction: Record<string, Prediction> = {};
  fleet.forEach((t) => (prediction[t.id] = predict(t.id, s.deg[t.id], s.offline ? 47 : 2)));
  return { fleet, prediction, fin: summarize(s.jobs) };
}

export const useStore = create<State>((set, get) => {
  const initialDeg = baseDeg();
  const init = {
    role: "senior" as Role, offline: false, lastSync: Date.now(),
    scenario: { kind: "none" as const, turbineId: null, phase: "idle" as Phase },
    deg: initialDeg, events: [] as EngineEvent[], windows: [] as MaintWindow[], selectedWindowId: null as string | null,
    approval: "none" as const, candidates: [] as Candidate[], selectionNote: "", candidateIdx: 0,
    assignment: null as Assignment | null, call: null as CallState | null, notices: [] as Notice[], jobs: [] as Job[],
    toasts: [] as Toast[], assistantOpen: false, clearanceItems: [false, false, false, false],
    chats: { senior: intro(), executive: intro(), technician: intro() } as Record<Role, ChatMessage[]>, chatBusy: false,
  };
  const derived = computeDerived(init);

  /** Apply a patch and recompute derived snapshot. */
  const patch = (p: Partial<State>) => {
    const next = { ...get(), ...p };
    set({ ...p, ...computeDerived(next), lastSync: Date.now() });
  };

  const ev = (e: Omit<EngineEvent, "id" | "ts"> & { ts?: number }) => {
    const full: EngineEvent = { id: uid("ev"), ts: Date.now(), ...e };
    set((s) => ({ events: [...s.events, full] }));
  };
  const notice = (n: Omit<Notice, "id" | "ts" | "read">) =>
    set((s) => ({ notices: [{ id: uid("n"), ts: Date.now(), read: false, ...n }, ...s.notices].slice(0, 40) }));
  const toast = (t: Omit<Toast, "id">) => get().toast(t);

  const makeAssignment = (turbineId: string, techId: string, kind: "planned" | "emergency", windowId: string | null, etaMin: number): Assignment => ({
    id: uid("AS"), turbineId, techId, kind, status: "offered", windowId, offeredAt: Date.now(), etaMin,
    action: "Replace main bearing (SKF) and verify lubrication", history: [{ status: "offered", ts: Date.now() }],
  });

  const openJob = (turbineId: string, kind: "planned" | "emergency", lost: number) => {
    const job: Job = {
      id: uid("JOB"), turbineId, kind, status: "open",
      plannedCost: kind === "planned" ? PLANNED_JOB_COST : EMERGENCY_JOB_COST, lostRevenue: lost,
      reactiveCostAvoided: kind === "planned" ? REACTIVE_FAILURE_COST : Math.round(REACTIVE_FAILURE_COST * 0.8),
      label: kind === "planned" ? `Planned bearing replacement ${turbineId}` : `Emergency bearing response ${turbineId}`,
    };
    patch({ jobs: [...get().jobs.filter((j) => !(j.turbineId === turbineId && j.status === "open")), job] });
  };

  return {
    ...init,
    ...derived,

    setRole: (r) => set({ role: r }),
    setOffline: (v) => {
      setApiOffline(v);
      patch({ offline: v });
      if (v) toast({ tone: "warning", title: "Offline mode", body: "Engine unreachable. Showing last known data; actions are queued locally." });
      else toast({ tone: "success", title: "Back online", body: "Reconnected to the unified engine." });
    },
    toggleAssistant: (v) => set((s) => ({ assistantOpen: v ?? !s.assistantOpen })),
    toast: (t) => {
      const id = uid("t");
      set((s) => ({ toasts: [...s.toasts, { id, ...t }].slice(-4) }));
      setTimeout(() => get().dismissToast(id), 5200);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    markAllRead: (role) => set((s) => ({ notices: s.notices.map((n) => (n.roles.includes(role) ? { ...n, read: true } : n)) })),
    markRead: (id) => set((s) => ({ notices: s.notices.map((n) => (n.id === id ? { ...n, read: true } : n)) })),

    // ------------------------------------------------------------------ demo controls
    reset: () => {
      clearAuto();
      patch({
        scenario: { kind: "none", turbineId: null, phase: "idle" }, deg: baseDeg(), events: [], windows: [], selectedWindowId: null,
        approval: "none", candidates: [], selectionNote: "", candidateIdx: 0, assignment: null, call: null, notices: [], jobs: [],
        clearanceItems: [false, false, false, false],
        chats: { senior: intro(), executive: intro(), technician: intro() },
      });
      toast({ tone: "info", title: "Demo reset", body: "All dashboards returned to baseline." });
    },
    startNormal: () => {
      get().reset();
      toast({ tone: "success", title: "Normal operation", body: "24 turbines monitored. All role views are synchronised." });
      ev({ step: 1, title: "Normal operation started", status: "done", actor: "system", explanation: "Fleet scoring is nominal. No anomalies above threshold.", details: [{ label: "Turbines monitored", value: "24" }, { label: "Data age", value: "2 min" }] });
    },

    simulateDegradation: () => {
      clearAuto();
      const id = FOCUS_YELLOW;
      if (get().scenario.kind === "none") patch({ events: [] });
      patch({ scenario: { kind: "yellow", turbineId: id, phase: "degrading" } });
      let d = get().deg[id];
      let flagged = false;
      toast({ tone: "info", title: `Simulating gradual degradation on ${id}`, body: "Watch temperature residual and risk rise on every dashboard." });
      degTimer = setInterval(() => {
        d = Math.min(d + 0.035, 0.46);
        patch({ deg: { ...get().deg, [id]: d } });
        if (!flagged && d > 0.22) {
          flagged = true;
          ev({ step: 1, title: "Sensor anomaly detected", turbineId: id, actor: "engine", status: "warning",
            explanation: "Bearing temperature residual exceeded 2σ of the healthy baseline while vibration began to trend upward.",
            details: [{ label: "Residual", value: "+3.8 °C" }, { label: "Anomaly score", value: "0.18" }] });
        }
        if (d >= 0.46) {
          if (degTimer) clearInterval(degTimer);
          degTimer = null;
          ev({ step: 2, title: "Bearing degradation identified", turbineId: id, actor: "engine", status: "warning",
            explanation: "Persistent residual growth and rising vibration RMS indicate progressive bearing wear. Risk is approaching the yellow threshold.",
            details: [{ label: "Degradation index", value: d.toFixed(2) }, { label: "Risk", value: `${Math.round(get().prediction[id].riskScore * 100)} %` }] });
        }
      }, 350);
    },

    triggerYellow: async () => {
      clearAuto();
      const id = FOCUS_YELLOW;
      const s0 = get();
      if (s0.scenario.kind === "red" && s0.scenario.phase !== "completed") get().reset();
      if (!get().events.some((e) => e.step === 1 && e.turbineId === id)) {
        ev({ step: 1, title: "Sensor anomaly detected", turbineId: id, actor: "engine", status: "warning", explanation: "Bearing temperature residual exceeded 2σ with rising vibration.", details: [{ label: "Residual", value: "+5.1 °C" }] });
        ev({ step: 2, title: "Bearing degradation identified", turbineId: id, actor: "engine", status: "warning", explanation: "Wear signature matches early raceway damage / lubricant-film breakdown.", details: [{ label: "Degradation index", value: "0.46" }] });
      }
      patch({ deg: { ...get().deg, [id]: YELLOW_D }, scenario: { kind: "yellow", turbineId: id, phase: "alert" } });
      const p = get().prediction[id];
      ev({ step: 3, title: "Failure risk evaluated — YELLOW", turbineId: id, actor: "engine", status: "warning",
        explanation: `Risk ${Math.round(p.riskScore * 100)} % exceeds the 35 % yellow threshold. Planned maintenance is recommended; no emergency action required.`,
        details: [{ label: "Risk", value: `${Math.round(p.riskScore * 100)} %` }, { label: "Confidence", value: `${Math.round(p.confidence * 100)} %` }] });
      ev({ step: 4, title: "Remaining useful life estimated", turbineId: id, actor: "engine", status: "done",
        explanation: `Estimated ${p.rulDays.toFixed(1)} days (80 % interval ${p.rulLo.toFixed(1)}–${p.rulHi.toFixed(1)} d). Estimated failure date ${fmtDateTime(p.failureDate)}.`,
        details: [{ label: "RUL", value: `${p.rulDays.toFixed(1)} d` }, { label: "Lower bound", value: `${p.rulLo.toFixed(1)} d` }] });
      notice({ roles: ["senior"], severity: "warning", title: `Yellow alert — ${id}`, body: `Bearing degradation, RUL ≈ ${p.rulDays.toFixed(1)} days. Windows are being analysed.`, link: `#/senior/predictive` });
      toast({ tone: "warning", title: `Yellow alert on ${id}`, body: "Planned maintenance recommended." });
    },

    showWindows: async () => {
      const id = FOCUS_YELLOW;
      if (get().scenario.kind !== "yellow" || get().scenario.phase === "degrading" || get().scenario.phase === "idle") await get().triggerYellow();
      try {
        const p = get().prediction[id];
        const windows = await api.getWindows(id, p.rulDays);
        const best = windows.find((w) => w.cheapestEligible);
        if (!best) {
          patch({ windows, selectedWindowId: null, candidates: [], selectionNote: "", approval: "none",
            scenario: { kind: "yellow", turbineId: id, phase: "alert" } });
          toast({ tone: "warning", title: "No eligible maintenance window", body: "Review the candidate checks." });
          return;
        }
        const dayOffset = Math.round((best.start - new Date().setHours(0, 0, 0, 0)) / 86400000);
        const rk = await api.rankTechnicians({ turbineId: id, emergency: false, dayOffset });
        const top = rk.candidates.find((c) => c.qualified);
        patch({ windows, selectedWindowId: best.id, candidates: rk.candidates, selectionNote: rk.explanation, approval: "pending", candidateIdx: 0,
          scenario: { kind: "yellow", turbineId: id, phase: "proposed" } });
        const cheapestOverall = [...windows].sort((a, b) => a.lostRevenue - b.lostRevenue)[0];
        ev({ step: 5, title: "Maintenance windows analysed", turbineId: id, actor: "engine", status: "done",
          explanation: `${windows.length} candidate windows evaluated across 7 days using wind forecast, electricity price and technician rota.`,
          details: [{ label: "Eligible", value: String(windows.filter((w) => w.eligible).length) }, { label: "Cheapest overall", value: `${fmtDateTime(cheapestOverall.start)} (${cheapestOverall.eligible ? "eligible" : "rejected"})` }] });
        ev({ step: 6, title: "Financial and safety constraints evaluated", turbineId: id, actor: "engine", status: "done",
          explanation: `Windows violating wind limit (12 m/s), weather hazard, 48 h failure safety margin or crew availability were excluded. Cheapest eligible window: ${fmtDateTime(best.start)}, lost revenue ${eur(best.lostRevenue)}. Site clearance remains pending — no window is declared safe before on-site checks.`,
          details: [{ label: "Lost revenue", value: eur(best.lostRevenue) }, { label: "Safety margin", value: `${best.safetyMarginH} h` }, { label: "Clearance", value: "Pending" }] });
        ev({ step: 7, title: "Qualified technicians ranked", turbineId: id, actor: "engine", status: "done", explanation: rk.explanation,
          details: [{ label: "Qualified", value: String(rk.candidates.filter((c) => c.qualified).length) }, { label: "Excluded", value: String(rk.candidates.filter((c) => !c.qualified).length) }] });
        ev({ step: 8, title: `Technician selected (provisional): ${top?.tech.name}`, turbineId: id, actor: "engine", status: "done",
          explanation: `Selected for the proposed window; assignment is sent only after senior approval.`, details: [{ label: "ETA", value: `${top?.etaMin} min` }, { label: "Transport", value: top?.tech.transport ?? "" }] });
        ev({ step: 9, title: "Approval requested from senior", turbineId: id, actor: "engine", status: "active",
          explanation: "Plan requires human approval before any dispatch. Recommended window: lowest-cost eligible; alternatives ranked.",
          details: [{ label: "Window", value: fmtDateTime(best.start) }, { label: "Approver", value: "Maintenance senior" }] });
        notice({ roles: ["senior"], severity: "warning", title: "Approval required", body: `Maintenance plan for ${id}: ${fmtDateTime(best.start)}, lost revenue ${eur(best.lostRevenue)}.`, link: "#/senior/optimization" });
        toast({ tone: "info", title: "Optimised windows ready", body: "Senior approval requested." });
      } catch (e) {
        toast({ tone: "critical", title: "Engine unreachable", body: (e as Error).message });
      }
    },

    selectWindow: (id) => {
      const w = get().windows.find((x) => x.id === id);
      if (!w) return;
      set({ selectedWindowId: id });
      if (!w.eligible) toast({ tone: "warning", title: "Window not eligible", body: w.statusLabel });
    },

    approvePlan: async () => {
      const s = get();
      const w = s.windows.find((x) => x.id === s.selectedWindowId);
      if (!w || !w.eligible) {
        toast({ tone: "critical", title: "Cannot approve", body: "Select an eligible window first." });
        return;
      }
      const top = s.candidates.find((c) => c.qualified);
      if (!top) {
        toast({ tone: "critical", title: "No qualified technician", body: "The engine will not dispatch an unqualified person." });
        return;
      }
      patch({ approval: "approved", scenario: { ...s.scenario, phase: "assigned" } });
      openJob(w.turbineId, "planned", w.lostRevenue);
      const a = makeAssignment(w.turbineId, top.tech.id, "planned", w.id, top.etaMin);
      patch({ assignment: a, candidateIdx: s.candidates.findIndex((c) => c.tech.id === top.tech.id) });
      ev({ step: 10, title: `Assignment communicated to ${top.tech.name}`, turbineId: w.turbineId, actor: "senior", status: "active",
        explanation: `Senior approved the plan for ${fmtDateTime(w.start)}. Assignment sent; awaiting technician acceptance. Dispatch does not authorise work before safety clearance.`,
        details: [{ label: "Approved by", value: "Senior (demo)" }, { label: "Awaiting", value: "Technician acceptance" }] });
      ev({ step: 11, title: "Stakeholders notified", turbineId: w.turbineId, actor: "engine", status: "done",
        explanation: "Executive received a business summary; technician received the task; operations dashboards updated.",
        details: [{ label: "Executive", value: `Projected net saving ${eur(REACTIVE_FAILURE_COST - PLANNED_JOB_COST - w.lostRevenue, true)}` }] });
      notice({ roles: ["technician"], severity: "info", title: "New assignment", body: `${w.turbineId}: bearing replacement, ${fmtDateTime(w.start)}.`, link: "#/tech/task" });
      notice({ roles: ["executive"], severity: "info", title: `Planned maintenance approved — ${w.turbineId}`, body: `A planned intervention avoids an estimated ${eur(REACTIVE_FAILURE_COST, true)} unplanned failure. Production impact ${eur(w.lostRevenue)}. Projected net saving ${eur(REACTIVE_FAILURE_COST - PLANNED_JOB_COST - w.lostRevenue, true)} (not yet realised).`, link: "#/exec/dashboard" });
      toast({ tone: "success", title: "Plan approved", body: `${top.tech.name} has been assigned.` });
    },

    rejectPlan: (reason) => {
      const s = get();
      patch({ approval: "rejected", scenario: { ...s.scenario, phase: "alert" } });
      ev({ step: 9, title: "Plan rejected by senior", status: "failed", turbineId: s.scenario.turbineId ?? undefined, actor: "senior",
        explanation: `${reason ?? "No reason given."} The engine will recompute alternatives on request. Risk monitoring continues.`, details: [] });
      toast({ tone: "warning", title: "Plan rejected", body: "Engine will propose alternatives; monitoring continues." });
    },

    simulateDispatch: () => {
      const s = get();
      if (!s.assignment) {
        toast({ tone: "warning", title: "Nothing to dispatch", body: "Approve a plan (or trigger a red alert) first." });
        return;
      }
      if (s.assignment.status === "offered") get().acceptAssignment();
      setTimeout(() => get().advance("travelling"), 300);
    },

    triggerRed: async () => {
      clearAuto();
      const id = FOCUS_RED;
      const prev = get();
      if (prev.scenario.kind === "yellow" && prev.scenario.phase !== "completed") {
        patch({ windows: [], selectedWindowId: null, approval: "none", assignment: null, candidates: [], call: null });
        ev({ step: 9, title: "Planned maintenance deferred", turbineId: prev.scenario.turbineId ?? undefined, actor: "engine", status: "warning",
          explanation: "An emergency has priority for qualified technicians; the planned job is re-queued.", details: [] });
      }
      patch({ deg: { ...get().deg, [id]: RED_D }, scenario: { kind: "red", turbineId: id, phase: "alert" }, approval: "none", windows: [], assignment: null, call: null });
      const p = get().prediction[id];
      ev({ step: 1, title: "Sensor anomaly detected — critical", turbineId: id, actor: "engine", status: "failed", explanation: "Residual +13.8 °C and vibration 7.5 mm/s RMS, both beyond critical limits.", details: [{ label: "Residual", value: "+13.8 °C" }, { label: "Vibration", value: "7.5 mm/s" }] });
      ev({ step: 2, title: "Bearing degradation identified", turbineId: id, actor: "engine", status: "failed", explanation: "Late-stage wear signature; rapid progression expected.", details: [] });
      ev({ step: 3, title: "Failure risk evaluated — RED", turbineId: id, actor: "engine", status: "failed", explanation: `Risk ${Math.round(p.riskScore * 100)} % exceeds the 75 % red threshold. Emergency protocol initiated.`, details: [{ label: "Risk", value: `${Math.round(p.riskScore * 100)} %` }] });
      ev({ step: 4, title: "Remaining useful life estimated", turbineId: id, actor: "engine", status: "failed", explanation: `Estimated ${Math.round(p.rulDays * 24)} h (lower bound ${Math.round(p.rulLo * 24)} h).`, details: [{ label: "RUL", value: `${Math.round(p.rulDays * 24)} h` }] });
      ev({ step: 6, title: "Emergency priority overrides financial optimisation", turbineId: id, actor: "engine", status: "warning", explanation: "Window optimisation bypassed. Safety first: no revenue-based delay is permitted. Dispatch does not bypass permit-to-work or safety clearance.", details: [{ label: "Optimisation", value: "Bypassed" }] });
      try {
        const rk = await api.rankTechnicians({ turbineId: id, emergency: true });
        patch({ candidates: rk.candidates, selectionNote: rk.explanation, candidateIdx: 0 });
        const q = rk.candidates.filter((c) => c.qualified);
        ev({ step: 7, title: "Qualified technicians ranked by response time", turbineId: id, actor: "engine", status: "done", explanation: rk.explanation, details: q.slice(0, 3).map((c) => ({ label: c.tech.name, value: `${c.etaMin} min` })) });
        ev({ step: 8, title: `First candidate: ${q[0]?.tech.name}`, turbineId: id, actor: "engine", status: "done", explanation: "Emergency call will be placed immediately (simulated).", details: [] });
        ev({ step: 9, title: "Emergency protocol initiated", turbineId: id, actor: "engine", status: "active", explanation: "Calling candidates in order. If nobody responds, automated dispatch stops and the senior is alerted.", details: [{ label: "Max attempts", value: String(Math.min(3, q.length)) }] });
        notice({ roles: ["senior"], severity: "critical", title: `RED ALERT — ${id}`, body: "Critical bearing risk. Emergency dispatch started.", link: "#/senior/engine" });
        notice({ roles: ["executive"], severity: "critical", title: `Critical turbine risk — ${id}`, body: `Failure possible within ~${Math.round(p.rulDays * 24)} h. Exposure up to ${eur(REACTIVE_FAILURE_COST, true)} if unplanned. Response under way.`, link: "#/exec/dashboard" });
        toast({ tone: "critical", title: `RED alert on ${id}`, body: "Emergency dispatch initiated." });
        // place first call
        const first = q[0];
        if (first) {
          const call: CallState = {
            turbineId: id, candidateIdx: 0, status: "ringing", startedAt: Date.now(),
            attempts: [{ techId: first.tech.id, outcome: "ringing" }],
            transcript: [{ who: "system", text: `Simulated emergency call to ${first.tech.name}…`, ts: Date.now() }],
          };
          patch({ call, scenario: { kind: "red", turbineId: id, phase: "calling" } });
        }
      } catch (e) {
        toast({ tone: "critical", title: "Engine unreachable", body: (e as Error).message });
      }
    },

    simulateEmergencyCalls: (mode) => {
      const s = get();
      if (!s.call || s.call.status !== "ringing") {
        toast({ tone: "warning", title: "No ringing call", body: "Trigger a red alert first." });
        return;
      }
      autoTimers.forEach(clearTimeout);
      autoTimers = [];
      const at = (ms: number, fn: () => void) => autoTimers.push(setTimeout(fn, ms));
      if (mode === "accept") at(1200, () => get().callRespond("accept"));
      if (mode === "decline_then_accept") {
        at(1200, () => get().callRespond("decline"));
        at(3800, () => get().callRespond("accept"));
      }
      if (mode === "no_response") {
        at(1200, () => get().callRespond("timeout"));
        at(3400, () => get().callRespond("timeout"));
        at(5600, () => get().callRespond("timeout"));
      }
    },

    callRespond: (action) => {
      const s = get();
      const call = s.call;
      if (!call || call.status !== "ringing") return;
      const q = s.candidates.filter((c) => c.qualified);
      const cur = q[call.candidateIdx];
      if (!cur) return;
      const line = (who: CallLine["who"], text: string): CallLine => ({ who, text, ts: Date.now() });
      const id = call.turbineId;
      if (action === "accept") {
        const transcript = [...call.transcript,
          line("engine", `This is the Team CGX engine. ${id} shows a critical bearing alert. Are you able to respond now?`),
          line("technician", "Yes — I can respond. Heading out now."),
          line("engine", `Thank you, ${cur.tech.name}. ETA ${cur.etaMin} min noted. Reminder: do not start any work before the permit-to-work and safety clearance are confirmed on site.`)];
        const attempts = call.attempts.map((a, i) => (i === call.candidateIdx ? { ...a, outcome: "answered" as const } : a));
        const asg = makeAssignment(id, cur.tech.id, "emergency", null, cur.etaMin);
        asg.status = "accepted";
        asg.acceptedAt = Date.now();
        asg.history.push({ status: "accepted", ts: Date.now() });
        patch({ call: { ...call, status: "connected", transcript, attempts }, assignment: asg, scenario: { kind: "red", turbineId: id, phase: "assigned" } });
        openJob(id, "emergency", 6200);
        ev({ step: 10, title: `Assignment accepted by ${cur.tech.name} (emergency call)`, turbineId: id, actor: "technician", status: "done", explanation: "Technician answered the simulated call and accepted. Safety clearance is still required before work.", details: [{ label: "ETA", value: `${cur.etaMin} min` }, { label: "Attempts", value: String(call.candidateIdx + 1) }] });
        ev({ step: 11, title: "Stakeholders notified", turbineId: id, actor: "engine", status: "done", explanation: "Senior received a live incident report; executive received a concise business-impact notification.", details: [] });
        notice({ roles: ["senior"], severity: "warning", title: "Emergency assignment accepted", body: `${cur.tech.name} responding to ${id}, ETA ${cur.etaMin} min.`, link: "#/senior/engine" });
        notice({ roles: ["executive"], severity: "info", title: `Response under way — ${id}`, body: `Technician en route. Estimated avoided cost if failure is prevented: ${eur(Math.round(REACTIVE_FAILURE_COST * 0.8), true)} (projected).`, link: "#/exec/dashboard" });
        setTimeout(() => set((x) => (x.call ? { call: { ...x.call, status: "ended" } } : {})), 4500);
        return;
      }
      const outcome = action === "decline" ? "declined" : "no_answer";
      const transcript = [...call.transcript,
        line("engine", `Emergency alert on ${id}. Can you respond?`),
        line(action === "decline" ? "technician" : "system", action === "decline" ? "I can't respond right now." : "No answer — call timed out.")];
      const attempts = call.attempts.map((a, i) => (i === call.candidateIdx ? { ...a, outcome: outcome as "declined" | "no_answer" } : a));
      ev({ step: 9, title: `${cur.tech.name} ${action === "decline" ? "declined" : "did not respond"}`, turbineId: id, actor: "technician", status: "warning", explanation: "Engine contacts the next qualified candidate.", details: [{ label: "Attempt", value: String(call.candidateIdx + 1) }] });
      const nextIdx = call.candidateIdx + 1;
      const maxAttempts = Math.min(3, q.length);
      if (nextIdx >= maxAttempts) {
        patch({ call: { ...call, status: "escalated", transcript: [...transcript, line("system", "No candidate responded. Automated dispatch stopped; escalated to senior.")], attempts }, scenario: { kind: "red", turbineId: id, phase: "escalated" } });
        ev({ step: 9, title: "Escalated to senior — automated dispatch stopped", turbineId: id, actor: "engine", status: "failed", explanation: `${maxAttempts} candidates contacted without acceptance. The engine stops auto-dispatch; the senior must take manual control.`, details: [] });
        notice({ roles: ["senior"], severity: "critical", title: "ESCALATION — manual dispatch required", body: `No technician accepted the emergency for ${id}. Automated dispatch stopped.`, link: "#/senior/technicians" });
        notice({ roles: ["executive"], severity: "critical", title: `Escalation — ${id}`, body: "No technician has accepted yet; the senior is taking manual control.", link: "#/exec/dashboard" });
        toast({ tone: "critical", title: "Escalated to senior", body: "Automated dispatch has stopped." });
        return;
      }
      const nxt = q[nextIdx];
      patch({
        call: { ...call, candidateIdx: nextIdx, attempts: [...attempts, { techId: nxt.tech.id, outcome: "ringing" }], transcript: [...transcript, line("system", `Calling next candidate: ${nxt.tech.name}…`)] },
        candidateIdx: nextIdx,
      });
    },

    completeMaintenance: () => {
      const s = get();
      if (!s.assignment || !s.scenario.turbineId) {
        toast({ tone: "warning", title: "No maintenance in progress", body: "Approve a plan or trigger an alert first." });
        return;
      }
      const a = s.assignment;
      const steps: AssignStatus[] = ["accepted", "travelling", "arrived", "cleared", "in_progress"];
      let cur = a;
      steps.forEach((st) => {
        if (steps.indexOf(st) > steps.indexOf(cur.status as AssignStatus) || cur.status === "offered") {
          cur = { ...cur, status: st, history: [...cur.history, { status: st, ts: Date.now() }] };
        }
      });
      patch({ assignment: cur, clearanceItems: [true, true, true, true] });
      get().submitCompletion("Main bearing replaced; torque and alignment verified; lubrication system flushed. (Auto-completed in demo mode.)", "Inner-race spalling visible on removed bearing; no secondary damage. Vibration normal after restart.");
    },

    // ------------------------------------------------------------------ technician workflow
    acceptAssignment: () => {
      const a = get().assignment;
      if (!a || a.status !== "offered") return;
      patch({ assignment: { ...a, status: "accepted", acceptedAt: Date.now(), history: [...a.history, { status: "accepted", ts: Date.now() }] }, scenario: { ...get().scenario, phase: "assigned" } });
      const t = TECHNICIANS.find((x) => x.id === a.techId)!;
      ev({ step: 10, title: `${t.name} accepted the assignment`, turbineId: a.turbineId, actor: "technician", status: "done", explanation: "Technician confirmed availability. Progress monitoring started.", details: [{ label: "ETA", value: `${a.etaMin} min` }] });
      notice({ roles: ["senior", "executive"], severity: "success", title: "Assignment accepted", body: `${t.name} accepted ${a.turbineId}.`, link: "#/senior/technicians" });
      toast({ tone: "success", title: "Assignment accepted" });
    },

    declineAssignment: (reason) => {
      const s = get();
      const a = s.assignment;
      if (!a) return;
      const q = s.candidates.filter((c) => c.qualified);
      const idx = q.findIndex((c) => c.tech.id === a.techId);
      const nxt = q[idx + 1];
      const t = TECHNICIANS.find((x) => x.id === a.techId)!;
      ev({ step: 10, title: `${t.name} declined the assignment`, turbineId: a.turbineId, actor: "technician", status: "warning", explanation: `Reason: ${reason}. ${nxt ? `Engine re-offers to ${nxt.tech.name}.` : "No further qualified candidates; senior notified."}`, details: [] });
      if (nxt) {
        const na = makeAssignment(a.turbineId, nxt.tech.id, a.kind, a.windowId, nxt.etaMin);
        patch({ assignment: na });
        notice({ roles: ["senior"], severity: "warning", title: "Technician declined", body: `${t.name} declined (${reason}). Re-offered to ${nxt.tech.name}.`, link: "#/senior/technicians" });
      } else {
        patch({ assignment: null });
        notice({ roles: ["senior"], severity: "critical", title: "No technician available", body: `${t.name} declined and no other qualified candidate remains.`, link: "#/senior/technicians" });
      }
      toast({ tone: "info", title: "Assignment declined", body: "The engine is re-offering the task." });
    },

    advance: (st) => {
      const a = get().assignment;
      if (!a) return;
      if (st === "in_progress" && !get().clearanceItems.every(Boolean)) {
        toast({ tone: "critical", title: "Safety clearance required", body: "Confirm every safety item before starting maintenance." });
        return;
      }
      patch({
        assignment: { ...a, status: st, history: [...a.history, { status: st, ts: Date.now() }] },
        scenario: { ...get().scenario, phase: st === "in_progress" || st === "cleared" ? "underway" : get().scenario.phase },
      });
      const label: Record<string, string> = { travelling: "Technician travelling", arrived: "Technician arrived on site", cleared: "Safety clearance confirmed on site", in_progress: "Maintenance started" };
      if (label[st]) {
        ev({ step: 12, title: label[st], turbineId: a.turbineId, actor: "technician", status: "done", explanation: st === "cleared" ? "Permit-to-work and lock-out/tag-out confirmed by the technician. Work may begin only now." : "Progress monitored by the engine.", details: [] });
        notice({ roles: ["senior"], severity: "info", title: label[st], body: a.turbineId, link: "#/senior/engine" });
      }
      toast({ tone: "success", title: label[st] ?? "Status updated" });
    },

    setClearance: (i, v) => set((s) => ({ clearanceItems: s.clearanceItems.map((x, k) => (k === i ? v : x)) })),

    submitCompletion: (notes, findings) => {
      const s = get();
      const a = s.assignment;
      if (!a) return;
      const job = s.jobs.find((j) => j.turbineId === a.turbineId && j.status === "open");
      patch({
        assignment: { ...a, status: "completed", completionNotes: notes, findings, history: [...a.history, { status: "completed", ts: Date.now() }] },
        deg: { ...s.deg, [a.turbineId]: 0.04 },
        jobs: s.jobs.map((j) => (j.id === job?.id ? { ...j, status: "completed" } : j)),
        scenario: { ...s.scenario, phase: "completed" },
        windows: s.scenario.kind === "yellow" ? s.windows : [],
        call: s.call ? { ...s.call, status: "ended" } : null,
      });
      const fin = get().fin;
      ev({ step: 12, title: "Maintenance completed", turbineId: a.turbineId, actor: "technician", status: "done", explanation: "Completion notes and inspection findings submitted. Bearing health restored; risk reset.", details: [{ label: "Findings", value: findings.slice(0, 70) }] });
      ev({ step: 13, title: "Final maintenance report generated", turbineId: a.turbineId, actor: "engine", status: "done", explanation: `Report compiled. Realised financial results updated: net savings ${eur(fin.realized.savings, true)} YTD (simulated).`, details: [{ label: "Failures prevented", value: String(fin.realized.prevented) }] });
      notice({ roles: ["senior", "executive"], severity: "success", title: `Maintenance complete — ${a.turbineId}`, body: `Savings now realised. Failures prevented YTD: ${fin.realized.prevented}.`, link: "#/exec/financial" });
      toast({ tone: "success", title: "Maintenance completed", body: "Executive financial results updated." });
    },

    // ------------------------------------------------------------------ AI chat
    sendChat: async (role, text) => {
      const um: ChatMessage = { id: uid("m"), role: "user", text, ts: Date.now() };
      set((s) => ({ chats: { ...s.chats, [role]: [...s.chats[role], um] }, chatBusy: true }));
      const s = get();
      const focusId = s.scenario.turbineId ?? [...s.fleet].sort((a, b) => b.riskScore - a.riskScore)[0].id;
      const ctx: AssistantCtx = {
        role, focus: s.fleet.find((t) => t.id === focusId), prediction: s.prediction[focusId], scenarioKind: s.scenario.kind, phase: s.scenario.phase,
        windows: s.windows, selected: s.windows.find((w) => w.id === s.selectedWindowId), approval: s.approval, assignment: s.assignment,
        assignedTech: TECHNICIANS.find((t) => t.id === s.assignment?.techId), candidates: s.candidates, call: s.call, fin: s.fin, fleet: s.fleet,
      };
      try {
        const r = await api.askAssistant(text, ctx);
        const am: ChatMessage = { id: uid("m"), role: "assistant", text: r.text, ts: Date.now(), refs: r.refs, report: r.report };
        set((x) => ({ chats: { ...x.chats, [role]: [...x.chats[role], am] }, chatBusy: false }));
      } catch (e) {
        const am: ChatMessage = { id: uid("m"), role: "assistant", text: `⚠ ${(e as Error).message}`, ts: Date.now() };
        set((x) => ({ chats: { ...x.chats, [role]: [...x.chats[role], am] }, chatBusy: false }));
      }
    },
  };
});

export const roleHome: Record<Role, string> = { senior: "#/senior/dashboard", executive: "#/exec/dashboard", technician: "#/tech/home" };
export const techIdFor = (s: Pick<State, "assignment" | "call" | "candidates">) => s.assignment?.techId ?? (s.call && s.call.status === "ringing" ? s.candidates.filter((c) => c.qualified)[s.call.candidateIdx]?.tech.id : undefined) ?? "T-01";
export { SUGGESTIONS, turbineById, degToRul };
