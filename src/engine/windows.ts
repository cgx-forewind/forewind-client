import type { MaintWindow } from "@/types";
import { dayStart, REQUIRED_SKILL, TECHNICIANS } from "./fleet";
import { availableOnDay, qualification } from "./dispatch";

const HOUR = 3600000;
const DAY = 24 * HOUR;
export const WIND_LIMIT_MS = 12; // max wind for nacelle work (simulated site rule)
export const MIN_MARGIN_H = 48;
export const MIN_LEAD_H = 6;

interface Spec { day: number; hour: number; wind: number; cond: string; price: number; hazard?: boolean; dur?: number }
const SPECS: Spec[] = [
  { day: 1, hour: 7, wind: 7.4, cond: "Clear, light breeze", price: 62 },
  { day: 1, hour: 13, wind: 9.9, cond: "Partly cloudy", price: 71 },
  { day: 2, hour: 7, wind: 14.6, cond: "Gale gusts, rain", price: 83, hazard: true },
  { day: 2, hour: 13, wind: 11.2, cond: "Showers, gusty", price: 77 },
  { day: 3, hour: 7, wind: 5.2, cond: "Clear, calm", price: 49 },
  { day: 4, hour: 7, wind: 6.4, cond: "Overcast, dry", price: 55 },
  { day: 4, hour: 13, wind: 8.1, cond: "Overcast, dry", price: 60 },
  { day: 5, hour: 7, wind: 3.1, cond: "Fog, near-calm", price: 39 },
  { day: 6, hour: 13, wind: 4.4, cond: "Clear, calm", price: 44 },
];

const powerFromWind = (v: number, rated = 3600) => rated * Math.min(1, Math.max(0, Math.pow((v - 3) / 9, 3)));

export function computeWindows(turbineId: string, rulDays: number, nowTs = Date.now()): MaintWindow[] {
  const deadline = nowTs + rulDays * DAY;
  const base = dayStart();
  const qualified = TECHNICIANS.filter((t) => qualification(t).length === 0 && t.skills.includes(REQUIRED_SKILL));
  const list: MaintWindow[] = SPECS.map((s, idx) => {
    const start = base + s.day * DAY + s.hour * HOUR;
    const dur = s.dur ?? 8;
    const end = start + dur * HOUR;
    const mwh = (powerFromWind(s.wind) * dur) / 1000;
    const lost = Math.round(mwh * s.price);
    const margin = (deadline - end) / HOUR;
    const techs = qualified.filter((t) => availableOnDay(t, s.day)).length;
    const lead = (start - nowTs) / HOUR;
    const checks = [
      { id: "wind", label: `Wind ≤ ${WIND_LIMIT_MS} m/s`, ok: s.wind <= WIND_LIMIT_MS, detail: `Forecast ${s.wind.toFixed(1)} m/s` },
      { id: "weather", label: "No storm / lightning / icing", ok: !s.hazard, detail: s.cond },
      { id: "margin", label: `Failure safety margin ≥ ${MIN_MARGIN_H} h`, ok: margin >= MIN_MARGIN_H, detail: `${margin.toFixed(0)} h before estimated failure deadline` },
      { id: "tech", label: "Qualified technician available", ok: techs > 0, detail: `${techs} qualified technician${techs === 1 ? "" : "s"} available` },
      { id: "lead", label: `Mobilisation lead time ≥ ${MIN_LEAD_H} h`, ok: lead >= MIN_LEAD_H, detail: `${lead.toFixed(0)} h from now` },
    ];
    const eligible = checks.every((c) => c.ok);
    const failed = checks.find((c) => !c.ok);
    return {
      id: `MW-${turbineId}-${idx + 1}`, turbineId, start, end, durationH: dur, windMs: s.wind, condition: s.cond,
      expectedMWh: +mwh.toFixed(1), priceEurMWh: s.price, lostRevenue: lost, failureDeadline: deadline,
      safetyMarginH: Math.round(margin), techAvailable: techs, checks, eligible, cheapestEligible: false, rank: null,
      clearance: "pending",
      statusLabel: eligible ? "Constraints met · site clearance pending" : `Not eligible — ${failed?.label.toLowerCase()} not met`,
    };
  });
  const el = list.filter((w) => w.eligible).sort((a, b) => a.lostRevenue - b.lostRevenue || b.safetyMarginH - a.safetyMarginH);
  el.forEach((w, i) => {
    w.rank = i + 1;
    w.cheapestEligible = i === 0;
  });
  return list;
}
