import type { Job } from "@/types";

// All figures are SIMULATED. They are internally consistent but are not SKF or customer data.
export const PLANNED_JOB_COST = 41800;
export const EMERGENCY_JOB_COST = 58600;
export const REACTIVE_FAILURE_COST = 236000;
export const PROGRAM_COST_YTD = 640000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan+", "Feb+"];
const planned = [96, 102, 88, 110, 94, 118, 104, 99, 121, 108, 92];
const reactive = [88, 0, 64, 0, 0, 71, 0, 0, 0, 52, 0];
const lost = [54, 31, 49, 28, 33, 52, 26, 22, 29, 47, 25];
const avoided = [210, 180, 236, 190, 260, 236, 180, 210, 236, 250, 208];
const fPlanned = [105, 98, 100];
const fReactive = [40, 35, 30];
const fAvoided = [190, 200, 205];

export interface MonthRow {
  month: string;
  planned: number;
  reactive: number;
  lost: number;
  avoided: number;
  kind: "realized" | "projected";
}

export interface FinanceSummary {
  realized: {
    spend: number; avoided: number; savings: number; lostRevenue: number; plannedSpend: number; reactiveSpend: number;
    prevented: number; predicted: number; plannedJobs: number; reactiveJobs: number; programCost: number; roi: number;
  };
  projected: { pendingSavings: number; exposure: number; upcomingCost: number; upcomingLost: number; openJobs: number };
  monthly: MonthRow[];
}

export function summarize(jobs: Job[]): FinanceSummary {
  const done = jobs.filter((j) => j.status === "completed");
  const open = jobs.filter((j) => j.status === "open");
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0) * 1000;
  const basePlanned = sum(planned);
  const baseReactive = sum(reactive);
  const doneCost = done.reduce((a, j) => a + j.plannedCost, 0);
  const doneAvoided = done.reduce((a, j) => a + j.reactiveCostAvoided, 0);
  const doneLost = done.reduce((a, j) => a + j.lostRevenue, 0);
  const avoidedTotal = sum(avoided) + doneAvoided;
  const savings = avoidedTotal - PROGRAM_COST_YTD;
  const monthly: MonthRow[] = planned.map((p, i) => ({
    month: MONTHS[i], planned: p * 1000 + (i === planned.length - 1 ? doneCost : 0), reactive: reactive[i] * 1000,
    lost: lost[i] * 1000 + (i === planned.length - 1 ? doneLost : 0), avoided: avoided[i] * 1000 + (i === planned.length - 1 ? doneAvoided : 0),
    kind: "realized",
  }));
  const openCost = open.reduce((a, j) => a + j.plannedCost, 0);
  const openLost = open.reduce((a, j) => a + j.lostRevenue, 0);
  fPlanned.forEach((p, i) =>
    monthly.push({ month: MONTHS[11 + i], planned: p * 1000 + (i === 0 ? openCost : 0), reactive: fReactive[i] * 1000, lost: 30000 + (i === 0 ? openLost : 0), avoided: fAvoided[i] * 1000, kind: "projected" }),
  );
  return {
    realized: {
      spend: basePlanned + baseReactive + doneCost, avoided: avoidedTotal, savings,
      lostRevenue: sum(lost) + doneLost, plannedSpend: basePlanned + doneCost, reactiveSpend: baseReactive,
      prevented: 11 + done.length, predicted: 14 + done.length + open.length, plannedJobs: 37 + done.length, reactiveJobs: 4,
      programCost: PROGRAM_COST_YTD, roi: savings / PROGRAM_COST_YTD,
    },
    projected: {
      pendingSavings: open.reduce((a, j) => a + (j.reactiveCostAvoided - j.plannedCost - j.lostRevenue), 0),
      exposure: open.length * REACTIVE_FAILURE_COST, upcomingCost: openCost, upcomingLost: openLost, openJobs: open.length,
    },
    monthly,
  };
}
