/**
 * Modular API service layer (MOCK).
 *
 * Every function here maps 1:1 to an endpoint of the unified intelligence engine.
 * To go live on Databricks, replace the bodies with `fetch("/api/engine/...")` calls
 * (e.g. Model Serving, Jobs or an Agent endpoint) — the frontend contains no
 * prediction, optimisation, safety or orchestration logic of its own.
 */
import type { Candidate, MaintWindow, Prediction, TelemetryPoint } from "@/types";
import { computeWindows } from "@/engine/windows";
import { explainSelection, rankTechnicians } from "@/engine/dispatch";
import { predict, simulateTelemetry } from "@/engine/telemetry";
import { respond, type AssistantCtx, type Reply } from "@/engine/assistant";
import { MAINT_HISTORY, INCIDENTS, PRED_VS_OBS, PERFORMANCE, sensorTrend14d } from "@/engine/history";
import { summarize, type FinanceSummary } from "@/engine/finance";
import type { Job } from "@/types";

let offline = false;
export const setApiOffline = (v: boolean) => {
  offline = v;
};
export class NetworkError extends Error {
  constructor() {
    super("Unable to reach the unified intelligence engine. Showing last known data.");
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function call<T>(fn: () => T, ms = 220): Promise<T> {
  await wait(ms);
  if (offline) throw new NetworkError();
  return fn();
}

export const api = {
  getTelemetry: (id: string, d: number, hours = 96): Promise<TelemetryPoint[]> => call(() => simulateTelemetry(id, d, hours), 380),
  getPrediction: (id: string, d: number, dataAgeMin: number): Promise<Prediction> => call(() => predict(id, d, dataAgeMin), 260),
  getWindows: (turbineId: string, rulDays: number): Promise<MaintWindow[]> => call(() => computeWindows(turbineId, rulDays), 450),
  rankTechnicians: (o: Parameters<typeof rankTechnicians>[0]): Promise<{ candidates: Candidate[]; explanation: string }> =>
    call(() => {
      const candidates = rankTechnicians(o);
      return { candidates, explanation: explainSelection(candidates, o.emergency) };
    }, 300),
  askAssistant: (q: string, ctx: AssistantCtx): Promise<Reply> => call(() => respond(q, ctx), 550),
  getFinance: (jobs: Job[]): Promise<FinanceSummary> => call(() => summarize(jobs), 300),
  getReports: () =>
    call(() => ({ history: MAINT_HISTORY, incidents: INCIDENTS, predVsObs: PRED_VS_OBS, performance: PERFORMANCE, trend: sensorTrend14d() }), 420),
};
