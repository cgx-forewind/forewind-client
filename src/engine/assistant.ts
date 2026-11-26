import type { Assignment, Candidate, CallState, MaintWindow, Prediction, Role, Technician, TurbineView, ChatMessage } from "@/types";
import { eur, fmtDateTime, num, pct } from "@/lib/utils";
import type { FinanceSummary } from "./finance";
import { RESIDUAL_SIGMA } from "./telemetry";
import { REACTIVE_FAILURE_COST } from "./finance";

export interface AssistantCtx {
  role: Role;
  focus?: TurbineView;
  prediction?: Prediction;
  scenarioKind: "none" | "yellow" | "red";
  phase: string;
  windows: MaintWindow[];
  selected?: MaintWindow;
  approval: "none" | "pending" | "approved" | "rejected";
  assignment?: Assignment | null;
  assignedTech?: Technician;
  candidates: Candidate[];
  call?: CallState | null;
  fin: FinanceSummary;
  fleet: TurbineView[];
}

export const SUGGESTIONS: Record<Role, string[]> = {
  senior: [
    "Why is the focus turbine flagged?",
    "Explain the temperature residual maths",
    "Which maintenance window is cheapest and why?",
    "Why was this technician selected?",
    "Generate the two-week operations report",
    "What is the current fleet risk?",
  ],
  executive: [
    "Give me an executive summary",
    "What is the financial impact of the current alert?",
    "How much have we saved this year?",
    "What are our critical business risks?",
    "Realised vs projected savings?",
  ],
  technician: [
    "What is my current task?",
    "What are the safety instructions?",
    "What equipment do I need?",
    "How is the weather on site?",
    "Can I start work on arrival?",
  ],
};

export interface Reply {
  text: string;
  refs?: ChatMessage["refs"];
  report?: ChatMessage["report"];
}

const has = (q: string, ...w: string[]) => w.some((x) => new RegExp(x, "i").test(q));

export function respond(q: string, c: AssistantCtx): Reply {
  const f = c.focus;
  const p = c.prediction;
  const fleetRisk = c.fleet.filter((t) => t.risk !== "green");
  const sel = c.selected;

  if (has(q, "hello|hi\\b|hey|help")) {
    return { text: c.role === "technician" ? "Hi — I can explain your task, safety steps, equipment and weather. What do you need?" : c.role === "executive" ? "Hello. I can summarise business impact, savings and risks in plain language. Try ‘Give me an executive summary’." : "Hello. I can pull sensor readings, predictions, maths behind the model, windows, technician selection and reports from the unified engine." };
  }

  // ----- Technician -----
  if (c.role === "technician") {
    const a = c.assignment;
    if (!a) return { text: "You have no active assignment right now. Upcoming routine tasks are listed on your dashboard. I will notify you the moment the engine dispatches something." };
    const emergency = a.kind === "emergency";
    if (has(q, "safe|safety|clear|permit|start work|begin"))
      return { text: `Safety first: do not climb or open the nacelle until the site permit-to-work and lock-out/tag-out are confirmed with the control room. Confirm each item in the safety checklist in the app — “Start maintenance” stays locked until you do.${emergency ? " This is an emergency dispatch; it does not authorise bypassing any safety step." : ""} Wind limit for nacelle work is 12 m/s; stop and descend if gusts exceed it.`, refs: [{ label: "Task safety checklist", href: "#/tech/task" }] };
    if (has(q, "equip|tool|bring|need"))
      return { text: "Bring: hydraulic bearing puller, torque kit, fall-arrest set, PPE, and the replacement bearing set (the depot has staged it). Valid GWO Basic Safety and Working at Heights are required." };
    if (has(q, "weather|wind|rain"))
      return { text: sel ? `Forecast for your slot: ${num(sel.windMs)} m/s wind, ${sel.condition.toLowerCase()}. Limit is 12 m/s — I will alert you if the forecast crosses it.` : "Current conditions are within limits. Check the task screen for the live forecast before you travel." };
    if (has(q, "eta|travel|how long|route"))
      return { text: `Estimated travel time is ${a.etaMin} min. Use the navigation card in your task to open the route.` };
    return { text: `Your task: ${a.action} on ${a.turbineId}. Status: ${a.status.replace("_", " ")}. ${emergency ? "Priority: EMERGENCY." : "Priority: planned."} Open the Task tab for the checklist and steps.`, refs: [{ label: `Task · ${a.turbineId}`, href: "#/tech/task" }] };
  }

  // ----- Executive -----
  if (c.role === "executive") {
    const fin = c.fin;
    if (has(q, "summary|brief|overview|status")) {
      const open = fin.projected.openJobs;
      return {
        text: `Fleet availability is ${pct(c.fleet.filter((t) => t.status === "operational").length / c.fleet.length)} with ${fleetRisk.length} turbine${fleetRisk.length === 1 ? "" : "s"} at risk. Year to date, predictive maintenance has avoided an estimated ${eur(fin.realized.avoided, true)} in failure costs (realised, simulated) for a programme cost of ${eur(fin.realized.programCost, true)}.${open ? ` ${open} intervention${open > 1 ? "s are" : " is"} in progress; once complete, projected net savings of ${eur(fin.projected.pendingSavings, true)} become realised.` : " No interventions are pending."}`,
        report: { title: "Executive summary (simulated)", rows: [["Fleet availability", pct(c.fleet.filter((t) => t.status === "operational").length / c.fleet.length)], ["Turbines at risk", String(fleetRisk.length)], ["Realised savings YTD", eur(fin.realized.savings, true)], ["Projected savings pending", eur(fin.projected.pendingSavings, true)], ["Failures prevented", String(fin.realized.prevented)]] },
        refs: [{ label: "Executive dashboard", href: "#/exec/dashboard" }],
      };
    }
    if (has(q, "saved|saving|roi|return|realis|realiz|projected"))
      return { text: `Realised so far: ${eur(fin.realized.savings, true)} net (avoided failure cost ${eur(fin.realized.avoided, true)} minus ${eur(fin.realized.programCost, true)} programme cost), ROI ≈ ${num(fin.realized.roi, 1)}×. Projected but not yet realised: ${eur(fin.projected.pendingSavings, true)} from interventions still open. Projections only count once the work is complete.`, refs: [{ label: "Financial intelligence", href: "#/exec/financial" }] };
    if (has(q, "impact|alert|cost|financ|money|exposure"))
      return f && c.scenarioKind !== "none"
        ? { text: `${f.id} is ${c.scenarioKind === "red" ? "critical" : "degrading"}. If it fails unplanned, the estimated cost is ${eur(REACTIVE_FAILURE_COST, true)} (parts, crane and roughly 9 days of lost production). The planned response costs about ${eur(sel ? sel.lostRevenue + 41800 : 41800, true)}${sel ? `, including ${eur(sel.lostRevenue)} of lost production in the chosen window` : ""}. Estimated avoidance: ${eur(fin.projected.pendingSavings > 0 ? fin.projected.pendingSavings : REACTIVE_FAILURE_COST - 58600, true)}. All figures simulated.` }
        : { text: "There is no active alert, so no near-term financial exposure. Planned versus reactive costs are on the Financial page." };
    if (has(q, "risk"))
      return { text: fleetRisk.length ? `Top business risk: ${fleetRisk.map((t) => t.id).join(", ")} — unplanned failure could cost about ${eur(REACTIVE_FAILURE_COST, true)} each. The engine is already coordinating the response.` : "No critical business risks at present. The main watch item is winter wind-speed volatility affecting maintenance scheduling." };
    return { text: "I can summarise the situation, explain savings (realised vs projected), or describe business risks. Which would you like?" };
  }

  // ----- Senior -----
  if (has(q, "residual|math|equation|formula|z-?score|sigma|model")) {
    const r = f?.residual ?? 0;
    return {
      text: `The model fits a load- and ambient-adjusted expectation on healthy history: T_exp = T_amb + 14 + 0.0105·P(kW). The residual is r = T_meas − T_exp. Currently r = ${num(r)} °C, i.e. z = r/σ = ${num(r / RESIDUAL_SIGMA)} with σ = ${RESIDUAL_SIGMA} °C. Anomaly score A = 1 − exp(−(r/8)²) = ${num(p?.anomaly ?? 0, 2)}. Failure risk uses a monotone degradation index d with risk = 0.04 + 0.93·d^1.3, and RUL = 20·(1−d)^1.3 days; the 80 % band is ≈ [0.74, 1.32]×RUL. (Simulated surrogate, not the production model.)`,
      refs: [{ label: "Predictive maintenance", href: "#/senior/predictive" }],
    };
  }
  if (has(q, "why.*(flag|alert|risk|degrad)|flagged|explain.*(prediction|alert)") && f && p)
    return { text: `${f.id} is ${p.risk.toUpperCase()} (risk ${pct(p.riskScore)}). ${p.explanation.slice(0, 3).join(" ")} Model confidence ${pct(p.confidence)}; data age ${p.dataAgeMin} min.`, refs: [{ label: `${f.id} details`, href: `#/senior/turbines/${f.id}` }] };
  if (has(q, "window|cheapest|schedule|eligible")) {
    if (!c.windows.length) return { text: "No maintenance windows have been computed yet. Windows are generated when a yellow alert is raised — use Demo mode ‘Display optimized windows’." };
    const best = c.windows.find((w) => w.cheapestEligible);
    return { text: best ? `Cheapest eligible window: ${fmtDateTime(best.start)} (${best.durationH} h), forecast ${num(best.windMs)} m/s, expected ${best.expectedMWh} MWh forgone, lost revenue ${eur(best.lostRevenue)}, ${best.safetyMarginH} h before the estimated failure deadline. Constraints are met, but the window is only cleared for work after on-site permit-to-work confirmation. ${c.windows.filter((w) => !w.eligible).length} windows are excluded — e.g. cheapest overall is rejected for insufficient safety margin.` : "No window currently satisfies all safety constraints.", refs: [{ label: "Maintenance optimisation", href: "#/senior/optimization" }] };
  }
  if (has(q, "technician|selected|why .*(tech|him|her)|dispatch|who")) {
    if (!c.candidates.length) return { text: "Technicians are ranked once a maintenance window is proposed or an emergency is initiated." };
    const top = c.assignedTech ?? c.candidates.find((x) => x.qualified)?.tech;
    const cand = c.candidates.find((x) => x.tech.id === top?.id);
    return { text: cand ? `${cand.tech.name}: ${cand.reasons.join("; ")}. Excluded candidates: ${c.candidates.filter((x) => !x.qualified).map((x) => `${x.tech.name} (${x.excluded})`).join("; ") || "none"}.` : "No qualified technician found.", refs: [{ label: "Technician management", href: "#/senior/technicians" }] };
  }
  if (has(q, "report|two-week|export")) {
    return { text: "Here is a preview of the two-week operations report (simulated). Open Reports to export it.", report: { title: "Two-week operations report", rows: [["Alerts raised", String(3 + (c.scenarioKind === "none" ? 0 : 1))], ["Maintenance completed", String(c.fin.realized.plannedJobs % 7 + 4)], ["Fleet availability", pct(c.fleet.filter((t) => t.status === "operational").length / c.fleet.length)], ["Predicted vs observed", "11 / 11 matched (sim.)"], ["Mean time to dispatch", "6 min"]] }, refs: [{ label: "Reports", href: "#/senior/reports" }] };
  }
  if (has(q, "fleet|risk|status|overview")) {
    return { text: fleetRisk.length ? `${fleetRisk.length} turbine${fleetRisk.length > 1 ? "s" : ""} need attention: ${fleetRisk.map((t) => `${t.id} (${t.risk}, risk ${pct(t.riskScore)}${t.rulDays ? `, RUL ${num(t.rulDays)} d` : ""})`).join("; ")}. The remaining fleet is healthy.` : `All monitored turbines are healthy. Highest watch-list risk: ${[...c.fleet].sort((a, b) => b.riskScore - a.riskScore)[0].id} at ${pct([...c.fleet].sort((a, b) => b.riskScore - a.riskScore)[0].riskScore)}.` };
  }
  if (f && has(q, "sensor|reading|temperature|vibration"))
    return { text: `${f.id} latest: bearing ${num(f.sensors.temp)} °C (residual ${num(f.residual)} °C), vibration ${num(f.sensors.vibration)} mm/s, rotor ${num(f.sensors.rpm)} rpm, power ${Math.round(f.sensors.power)} kW, ambient ${num(f.sensors.ambient)} °C.` };
  return { text: "I can explain a prediction, the residual mathematics, window ranking, technician selection, fleet risk, or generate a report. Try one of the suggestions below." };
}
