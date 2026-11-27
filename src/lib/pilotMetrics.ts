// Pilot definitions and source mappings are documented in public/training/SOURCES.md.
type Input = number | null;
export type Result = { value: Input; detail: string };
function missing(detail: string): Result { return { value: null, detail }; }

export function delivery(grid: Input, free: Input, cap: Input, producing: boolean, floor: Input): Result {
  if (cap === null) return missing("Commanded power cap unavailable");
  if (free === null) return missing("Validated unrestricted power reference unavailable");
  if (grid === null) return missing("Measured grid output unavailable");
  if (!producing) return missing("Steady production unverified");
  const target = Math.min(free, cap);
  if (floor === null || floor <= 0 || target < floor) return missing("Usable power target unverified or below floor");
  return { value: grid / target, detail: `${grid} / min(${free}, ${cap}) in matching power units` };
}

export function inverseTipSpeed(wind: Input, rpm: Input, radius: Input): Result {
  if (radius === null || radius <= 0) return missing("Rotor radius unavailable");
  if (rpm === null || rpm < 1) return missing("Rotor speed unavailable or below the 1 rpm pilot floor");
  if (wind === null || wind < 0) return missing("Valid wind speed unavailable");
  return { value: wind / (2 * Math.PI * radius * rpm / 60), detail: `${wind} m/s / (2π × ${radius} m × ${rpm} rpm / 60)` };
}

export function windPerKelvin(wind: Input, celsius: Input): Result {
  if (celsius === null || celsius <= -273.15) return missing("Valid outdoor temperature unavailable");
  if (wind === null || wind < 0) return missing("Valid wind speed unavailable");
  return { value: wind / (celsius + 273.15), detail: `${wind} m/s / (${celsius} °C + 273.15)` };
}

const WEEK = 7 * 86400000;
function weekStart(time: number) {
  const monday = Date.UTC(1970, 0, 5);
  return monday + Math.floor((time - monday) / WEEK) * WEEK;
}

// Entries belong to one turbine, one reference model and comparable operating conditions.
export function weeklyDelivery(times: number[], ratios: Input[]): Result[] {
  const groups = new Map<number, Map<number, number>>();
  for (const [i, time] of times.entries()) {
    const value = ratios[i];
    if (value === null || !Number.isFinite(value)) continue;
    const week = weekStart(time);
    const slots = groups.get(week) ?? new Map<number, number>();
    slots.set(Math.floor(time / 600000), value);
    groups.set(week, slots);
  }
  const medians = new Map<number, number>();
  for (const [week, slots] of groups) {
    if (slots.size < Math.ceil(1008 * 0.8)) continue;
    const values = [...slots.values()].sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    medians.set(week, (values[mid] + values[Math.floor((values.length - 1) / 2)]) / 2);
  }
  const first = Math.min(...medians.keys());
  const base = medians.get(first);
  return times.map(time => {
    const previous = weekStart(time) - WEEK;
    const current = medians.get(previous);
    if (base === undefined || previous < first || current === undefined)
      return missing("Requires a completed week with ≥80% eligible giz1 coverage and a fixed baseline");
    if (base < 0.01) return missing("Baseline delivery ratio below the 0.01 pilot floor");
    return { value: 100 * current / base, detail: `Week of ${new Date(previous).toISOString().slice(0, 10)}: 100 × ${current} / ${base} (baseline week ${new Date(first).toISOString().slice(0, 10)})` };
  });
}

export function pilotSeries(source: string, turbine: string, columns: string[], rows: (string | null)[][], stamps: string[]) {
  const indices = new Map(columns.map((name, i) => [name, i]));
  const uk = source === "kelmarsh" || source === "penmanshiel";
  const care = source === "care";
  const ukRadii: Record<string, Record<string, number>> = {
    kelmarsh: { "1": 46, "2": 46, "3": 46, "4": 46, "5": 46, "6": 46 },
    penmanshiel: { "11": 41, "12": 41, "13": 41, "14": 41, "15": 41 },
  };
  const radius = ukRadii[source]?.[turbine] ?? (source === "la-haute-borne" && ["R80711","R80721","R80736","R80790"].includes(turbine) ? 41 : null);
  const readings = rows.map(row => {
    function read(name: string): Input {
      const index = indices.get(name);
      const raw = index === undefined ? null : row[index];
      if (raw == null || raw.trim() === "") return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }
    const wind = read(uk ? "Wind speed (m/s)" : care ? "wind_speed_3_avg" : "Ws_avg");
    const outside = read(uk ? "Nacelle ambient temperature (°C)" : care ? "sensor_0_avg" : "Ot_avg");
    const rpm = uk ? read("Rotor speed (RPM)") : care ? read("sensor_52_avg") : null;
    // The four extracts lack an approved unrestricted reference and steady-state mapping.
    const giz1 = delivery(read(uk ? "Power (kW)" : care ? "power_30_avg" : "P_avg"), null,
      uk ? read("Turbine Power setpoint (kW)") : null, false, null);
    return { giz1, simi1: inverseTipSpeed(wind, rpm, radius), shipi1: windPerKelvin(wind, outside) };
  });
  const times = stamps.map(stamp => {
    const iso = stamp.replace(" ", "T");
    return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : iso + "Z");
  });
  const weekly = weeklyDelivery(times, readings.map(r => r.giz1.value));
  return readings.map((r, i) => ({ ...r, lazer1: weekly[i] }));
}
