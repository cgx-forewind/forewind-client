import { dayStart } from "./fleet";
import { mulberry32, gauss } from "./rng";

const DAY = 86400000;
const d = (n: number) => dayStart() - n * DAY;

export interface HistoryRow {
  id: string; turbineId: string; date: number; type: "Planned" | "Reactive" | "Inspection"; action: string;
  durationH: number; tech: string; cost: number; outcome: string;
}
export const MAINT_HISTORY: HistoryRow[] = [
  { id: "WO-2291", turbineId: "WT-14", date: d(2), type: "Planned", action: "Main bearing replacement", durationH: 9, tech: "Lena Brandt", cost: 41200, outcome: "Completed, vibration normalised" },
  { id: "WO-2287", turbineId: "WT-22", date: d(3), type: "Inspection", action: "Borescope + lubrication check", durationH: 4, tech: "Aisha Rahman", cost: 4800, outcome: "No defects" },
  { id: "WO-2279", turbineId: "WT-05", date: d(5), type: "Planned", action: "Main bearing replacement", durationH: 8, tech: "Omar Haddad", cost: 42600, outcome: "Completed, early spalling confirmed" },
  { id: "WO-2270", turbineId: "WT-18", date: d(7), type: "Reactive", action: "Pitch bearing fault repair", durationH: 14, tech: "Mateo Silva", cost: 28900, outcome: "Completed" },
  { id: "WO-2262", turbineId: "WT-09", date: d(8), type: "Inspection", action: "Vibration verification", durationH: 3, tech: "Lena Brandt", cost: 3600, outcome: "False positive — closed" },
  { id: "WO-2255", turbineId: "WT-21", date: d(10), type: "Planned", action: "Main bearing replacement", durationH: 8, tech: "Jonas Weber", cost: 43900, outcome: "Completed" },
  { id: "WO-2249", turbineId: "WT-02", date: d(12), type: "Planned", action: "Lubricant system service", durationH: 5, tech: "Aisha Rahman", cost: 7400, outcome: "Completed" },
  { id: "WO-2240", turbineId: "WT-16", date: d(13), type: "Inspection", action: "Condition monitoring audit", durationH: 3, tech: "Omar Haddad", cost: 3100, outcome: "No defects" },
];

export const INCIDENTS = [
  { id: "INC-118", turbineId: "WT-14", date: d(4), severity: "Yellow", summary: "Bearing residual +6.4 °C; replacement scheduled and completed in lowest-revenue window.", resolved: true },
  { id: "INC-116", turbineId: "WT-18", date: d(7), severity: "Red", summary: "Pitch bearing fault; emergency dispatch, 41 min to first technician contact.", resolved: true },
  { id: "INC-113", turbineId: "WT-05", date: d(9), severity: "Yellow", summary: "Vibration trend; replacement completed 3.2 days before predicted failure.", resolved: true },
  { id: "INC-109", turbineId: "WT-09", date: d(11), severity: "Yellow", summary: "Alert withdrawn after inspection — sensor drift, recalibrated.", resolved: true },
];

export const PRED_VS_OBS = [
  { turbineId: "WT-14", predicted: d(-3), observed: "Prevented (replaced D+0)", errorDays: 0.0, result: "Prevented" },
  { turbineId: "WT-05", predicted: d(-8), observed: "Spalling confirmed at replacement", errorDays: 0.0, result: "Confirmed" },
  { turbineId: "WT-21", predicted: d(-6), observed: "Early wear confirmed", errorDays: 0.0, result: "Confirmed" },
  { turbineId: "WT-18", predicted: d(6), observed: "Failure occurred D-7 (unplanned)", errorDays: 1.4, result: "Late warning" },
  { turbineId: "WT-09", predicted: d(-12), observed: "No defect found", errorDays: 0, result: "False positive" },
];

export const PERFORMANCE = [
  { label: "Mean time to detect", value: "3.1 h" },
  { label: "Mean time to dispatch", value: "6 min" },
  { label: "Planned vs reactive ratio", value: "9.3 : 1" },
  { label: "Safety-clearance compliance", value: "100 %" },
  { label: "Prediction precision (sim.)", value: "92 %" },
  { label: "Fleet availability (14 d)", value: "97.4 %" },
];

export function sensorTrend14d() {
  const r = mulberry32(777);
  return Array.from({ length: 14 }, (_, i) => ({
    day: new Date(d(13 - i)).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    residual: +(0.9 + Math.sin(i / 2.5) * 0.3 + gauss(r) * 0.12 + i * 0.03).toFixed(2),
    vibration: +(2.1 + Math.cos(i / 3) * 0.1 + gauss(r) * 0.05).toFixed(2),
  }));
}

export const BASE_ACTIVITY = [
  { m: 14, text: "Nightly model refresh completed — 24 turbines scored" },
  { m: 38, text: "Weather forecast updated (7-day, hourly)" },
  { m: 71, text: "Sensor data quality check passed (99.6 % completeness)" },
  { m: 125, text: "WT-11 added to watch-list (risk 24 %, green)" },
  { m: 190, text: "Electricity price curve refreshed" },
];
