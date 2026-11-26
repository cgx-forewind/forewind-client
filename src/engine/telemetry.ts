import type { Prediction, Risk, TelemetryPoint, TurbineSeed, TurbineStatus, TurbineView, MaintStatus, Contribution } from "@/types";
import { clamp } from "@/lib/utils";
import { gauss, hash, mulberry32 } from "./rng";
import { FLEET } from "./fleet";

const HOUR = 3600000;

export const RESIDUAL_SIGMA = 1.9; // °C, healthy-baseline residual std (simulated)
export const degToRisk = (d: number) => clamp(0.04 + 0.93 * Math.pow(Math.max(d, 0), 1.3), 0, 0.99);
export const degToRul = (d: number) => Math.max(0.4, 20 * Math.pow(1 - clamp(d, 0, 0.99), 1.3));
export const riskClass = (score: number): Risk => (score >= 0.75 ? "red" : score >= 0.35 ? "yellow" : "green");

const cache = new Map<string, TelemetryPoint[]>();

/** Deterministic synthetic telemetry. `d` = final degradation level (0-1). */
export function simulateTelemetry(id: string, d: number, hours = 96, endTs = Date.now()): TelemetryPoint[] {
  const end = Math.floor(endTs / HOUR) * HOUR;
  const key = `${id}|${d.toFixed(3)}|${hours}|${end}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 400) cache.clear();

  const seed = FLEET.find((t) => t.id === id);
  const rated = seed?.ratedKw ?? 3600;
  const r = mulberry32(hash(id));
  const pts: TelemetryPoint[] = [];
  let windNoise = 0;
  let ambNoise = 0;
  for (let i = 0; i < hours; i++) {
    const ts = end - (hours - 1 - i) * HOUR;
    const hr = new Date(ts).getHours();
    windNoise = windNoise * 0.85 + gauss(r) * 0.8;
    ambNoise = ambNoise * 0.9 + gauss(r) * 0.25;
    const wind = clamp(8.4 + 3.0 * Math.sin(((hr - 6) / 24) * 2 * Math.PI) + windNoise, 1.5, 19);
    const cf = clamp(Math.pow((wind - 3) / 9, 3), 0, 1);
    const power = rated * cf;
    const rpm = wind < 3 ? 0 : 6.2 + 8.8 * Math.min(1, (wind - 3) / 9) + gauss(r) * 0.12;
    const ambient = 4.2 + 3.6 * Math.sin(((hr - 9) / 24) * 2 * Math.PI) + ambNoise;
    const expected = ambient + 14 + 0.0105 * power;
    const di = d * Math.pow(i / (hours - 1), 2.2);
    const residual = 15 * di + gauss(r) * 0.55;
    const temp = expected + residual;
    const vibration = Math.max(0.6, 2.0 + 6.2 * di + gauss(r) * 0.11 + 0.012 * (power / 100));
    const anomaly = clamp(1 - Math.exp(-Math.pow(Math.max(residual, 0) / 8, 2)), 0, 1);
    const risk = degToRisk(di);
    const band = 0.03 + 0.14 * risk;
    pts.push({
      i, ts,
      label: new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      temp: +temp.toFixed(2), expected: +expected.toFixed(2), residual: +residual.toFixed(2),
      vibration: +vibration.toFixed(2), rpm: +rpm.toFixed(2), power: Math.round(power), ambient: +ambient.toFixed(2),
      wind: +wind.toFixed(1), anomaly: +anomaly.toFixed(3), risk: +risk.toFixed(3),
      riskLo: +clamp(risk - band, 0, 1).toFixed(3), riskHi: +clamp(risk + band, 0, 1).toFixed(3),
    });
  }
  cache.set(key, pts);
  return pts;
}

export function predict(id: string, d: number, dataAgeMin = 2): Prediction {
  const series = simulateTelemetry(id, d);
  const last = series[series.length - 1];
  const prev = series[series.length - 25] ?? series[0];
  const riskScore = degToRisk(d);
  const risk = riskClass(riskScore);
  const rul = degToRul(d);
  const rulLo = rul * 0.74;
  const rulHi = rul * 1.32;
  const rate = ((last.residual - prev.residual) / 24) * 24; // °C/day
  const z = last.residual / RESIDUAL_SIGMA;
  const raw = [0.42 * d + 0.12, 0.36 * d + 0.1, 0.1 * d + 0.05, 0.08 * d + 0.05, 0.04];
  const tot = raw.reduce((a, b) => a + b, 0);
  const contributions: Contribution[] = [
    { sensor: "Temperature residual", share: raw[0] / tot, note: `${last.residual.toFixed(1)} °C above load-adjusted expectation (${z.toFixed(1)}σ)` },
    { sensor: "Vibration (RMS)", share: raw[1] / tot, note: `${last.vibration.toFixed(1)} mm/s vs 2.0 mm/s healthy baseline` },
    { sensor: "Rotor speed variance", share: raw[2] / tot, note: "Torque ripple at low-speed operating points" },
    { sensor: "Load cycling (power)", share: raw[3] / tot, note: "Frequent ramps between 40–90 % rated power" },
    { sensor: "Ambient temperature", share: raw[4] / tot, note: `${last.ambient.toFixed(1)} °C — minor effect after compensation` },
  ];
  const explanation: string[] = [];
  if (risk === "green") {
    explanation.push("Bearing temperature tracks the load- and ambient-adjusted expectation within normal scatter.");
    explanation.push(`Vibration (${last.vibration.toFixed(1)} mm/s RMS) is within the healthy band; no persistent anomaly.`);
    explanation.push("No maintenance action is recommended. Monitoring continues at the standard cadence.");
  } else {
    explanation.push(`Bearing temperature is ${last.residual.toFixed(1)} °C above the load-adjusted expectation (${z.toFixed(1)}σ) and has risen ≈${Math.max(rate, 0).toFixed(1)} °C over the last 24 h.`);
    explanation.push(`Vibration has climbed to ${last.vibration.toFixed(1)} mm/s RMS (baseline 2.0), consistent with early raceway wear or lubricant-film breakdown.`);
    explanation.push(`The degradation trajectory implies a remaining useful life of ${rul.toFixed(1)} days (80% interval ${rulLo.toFixed(1)}–${rulHi.toFixed(1)} d).`);
    explanation.push("The estimate widens as sensor evidence accumulates less certainty at the tail; the engine uses the lower bound for safety margins.");
  }
  const recommended =
    risk === "green"
      ? ["Continue condition monitoring", "Next scheduled inspection as planned"]
      : risk === "yellow"
        ? [
            "Schedule main-bearing replacement before the lower RUL bound minus safety margin",
            "Pre-order bearing set and lift equipment",
            "Increase sampling to 1-minute resolution",
          ]
        : [
            "Initiate emergency dispatch — emergency priority overrides cost optimisation",
            "Engine requests senior to confirm derating/curtailment",
            "No work starts until permit-to-work and safety clearance are confirmed on site",
          ];
  return {
    turbineId: id, risk, riskScore, anomaly: last.anomaly, rulDays: rul, rulLo, rulHi,
    failureDate: Date.now() + rul * 86400000,
    confidence: clamp(0.93 - 0.14 * d - (dataAgeMin > 30 ? 0.08 : 0), 0.5, 0.97),
    contributions, dataAgeMin, recommended, explanation, simulated: true,
  };
}

export interface FleetOverrides {
  status?: Record<string, TurbineStatus>;
  maint?: Record<string, MaintStatus>;
}

export function buildTurbineView(seed: TurbineSeed, d: number, ov: FleetOverrides = {}): TurbineView {
  const s = simulateTelemetry(seed.id, d);
  const last = s[s.length - 1];
  const riskScore = degToRisk(d);
  const risk = riskClass(riskScore);
  const status = ov.status?.[seed.id] ?? seed.baseStatus;
  return {
    ...seed,
    status,
    maint: ov.maint?.[seed.id] ?? (status === "maintenance" ? "in_progress" : "none"),
    risk: status === "maintenance" && !ov.maint?.[seed.id] ? "green" : risk,
    riskScore,
    rulDays: risk === "green" ? null : degToRul(d),
    degradation: d,
    sensors: { temp: last.temp, vibration: last.vibration, rpm: status === "offline" ? 0 : last.rpm, power: status === "offline" ? 0 : last.power, ambient: last.ambient },
    residual: last.residual,
  };
}
