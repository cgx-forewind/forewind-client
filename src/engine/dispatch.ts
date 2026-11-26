import type { Candidate, Technician } from "@/types";
import { REQUIRED_CERTS, REQUIRED_EQUIPMENT, REQUIRED_SKILL, TECHNICIANS, turbineById } from "./fleet";

const KM_PER_UNIT = 0.18; // schematic map units → km

export function distanceKm(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by) * KM_PER_UNIT;
}
export function etaMinutes(t: Technician, turbineId: string) {
  const tb = turbineById(turbineId);
  if (!tb) return 60;
  const km = distanceKm(t.x, t.y, tb.x, tb.y);
  const mobilise = t.transport === "Helicopter transfer" ? 25 : 10;
  return Math.round((km / t.speedKmh) * 60 + mobilise);
}

export function qualification(t: Technician) {
  const missing: string[] = [];
  if (!t.skills.includes(REQUIRED_SKILL)) missing.push(REQUIRED_SKILL);
  REQUIRED_CERTS.forEach((c) => !t.certs.includes(c) && missing.push(c));
  REQUIRED_EQUIPMENT.forEach((e) => !t.equipment.includes(e) && missing.push(e));
  return missing;
}

export function availableOnDay(t: Technician, dayOffset: number) {
  return t.status !== "off_shift" && !t.unavailableDays.includes(dayOffset) && t.currentAssignment === null;
}

interface RankOpts {
  turbineId: string;
  emergency: boolean;
  dayOffset?: number;
  excludeIds?: string[];
  busyIds?: string[];
}

/** Ranks technicians. Planned: qualification gate, then ETA/workload/rating blend. Emergency: ETA only (among qualified, on-call). */
export function rankTechnicians(o: RankOpts): Candidate[] {
  const list: Candidate[] = TECHNICIANS.map((t) => {
    const tb = turbineById(o.turbineId)!;
    const km = distanceKm(t.x, t.y, tb.x, tb.y);
    const eta = etaMinutes(t, o.turbineId);
    const missing = qualification(t);
    const reasons: string[] = [];
    let excluded: string | undefined;
    if (missing.length) excluded = `Missing: ${missing.join(", ")}`;
    else if (t.status === "off_shift") excluded = "Off shift for the planning horizon";
    else if (!o.emergency && o.dayOffset !== undefined && t.unavailableDays.includes(o.dayOffset)) excluded = "Not available on the selected day";
    else if (o.emergency && !t.onCall) excluded = "Not on emergency call rota";
    else if (o.excludeIds?.includes(t.id)) excluded = "Already contacted for this incident";
    else if (o.busyIds?.includes(t.id) || t.currentAssignment) excluded = "Currently assigned elsewhere";
    const qualified = !excluded;
    if (!missing.length) reasons.push(`Holds all ${REQUIRED_CERTS.length} required certifications and the bearing-replacement skill`);
    reasons.push(`ETA ${eta} min by ${t.transport.toLowerCase()} (${km.toFixed(1)} km)`);
    if (!o.emergency) reasons.push(`Weekly workload ${t.workloadH} h · rating ${t.rating.toFixed(1)}`);
    const score = o.emergency ? 1000 - eta : 100 - eta * 0.22 - t.workloadH * 0.55 + t.rating * 4;
    return { tech: t, etaMin: eta, distanceKm: km, score: +score.toFixed(1), qualified, reasons, excluded };
  });
  return list.sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.score - a.score);
}

export function explainSelection(c: Candidate[], emergency: boolean) {
  const q = c.filter((x) => x.qualified);
  if (!q.length) return "No qualified technician is currently available. The engine will not dispatch an unqualified person; the incident is escalated to the senior.";
  const top = q[0];
  const next = q[1];
  const why = emergency
    ? `Emergency prioritisation: among ${q.length} qualified on-call technicians, ${top.tech.name} has the shortest estimated response time (${top.etaMin} min by ${top.tech.transport.toLowerCase()}).`
    : `${top.tech.name} ranks first of ${q.length} qualified technicians: shortest travel time among low-workload candidates (${top.etaMin} min, ${top.tech.workloadH} h weekly load) with a ${top.tech.rating.toFixed(1)} service rating.`;
  const alt = next ? ` Next in line: ${next.tech.name} (${next.etaMin} min).` : "";
  const ex = c.filter((x) => !x.qualified);
  const exTxt = ex.length ? ` Excluded: ${ex.map((x) => `${x.tech.name} (${x.excluded})`).join("; ")}.` : "";
  return why + alt + exTxt + " Selection never replaces on-site safety clearance.";
}
