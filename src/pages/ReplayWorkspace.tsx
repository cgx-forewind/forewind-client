import { useEffect, useMemo, useRef, useState } from "react";
import { HistoricalMetrics } from "@/components/HistoricalMetrics";
import { useReplay } from "@/components/SignalReplay";
import { TrainingSources } from "@/components/TrainingSources";
import { WarehouseSignals } from "@/components/WarehouseSignals";
import { delivery } from "@/lib/pilotMetrics";
import type { Route } from "@/lib/router";
import WindForecast from "./senior/WindForecast";

function numeric(raw: string | number | null) {
  if (raw === null || String(raw).trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function fmt(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString("en-GB", { maximumFractionDigits: 3 });
}

function DeliveryGauge({ power }: { power: number | null }) {
  const result = delivery(power, 1000, 1000, true, 50);
  const target = result.value === null ? 0 : 100 * result.value;
  const shown = useRef(target);
  const [value, setValue] = useState(target);
  useEffect(() => {
    const start = performance.now();
    const from = shown.current;
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420;
    let frame = 0;
    function tick(now: number) {
      const t = duration ? Math.min(1, (now - start) / duration) : 1;
      shown.current = from + (target - from) * (1 - (1 - t) ** 3);
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <section className="rounded-xl border border-line bg-white p-5">
    <h2 className="font-semibold">Giz1 · Power delivered against target</h2>
    <div className="my-3 text-4xl font-semibold tabular-nums">{value.toFixed(1)}%</div>
    <progress className="w-full accent-teal-600" aria-label="Giz1 delivery" value={value} max="100" />
    <p className="mt-2 text-sm">Synthetic steady production · {fmt(power)} kW delivered ÷ min(1,000 kW unrestricted, 1,000 kW cap) × 100.</p>
    {target <= 97 && <p className="mt-2 font-semibold">Detection · Delivery reached the 97% test threshold.</p>}
  </section>;
}

const titles: Record<string, string> = {
  dashboard: "Performance overview", predictive: "Predictive maintenance", turbines: "Turbine measurements",
  assets: "Asset measurements", financial: "Recorded energy", optimization: "Maintenance planning",
  reports: "Replay report", engine: "Detection engine", technicians: "Technician handoff", home: "Field overview",
  task: "Task evidence", assistant: "Replay guide",
};

function utc(stamp: string) {
  const iso = stamp.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : iso + "Z");
}

export default function ReplayWorkspace({ route }: { route: Route }) {
  const track = useReplay(s => s.track);
  const reading = useReplay(s => s.reading);
  const source = track.key.split(":")[0];
  const fixture = source === "delivery-test";
  const series = useMemo(() => {
    let energy = 0, samples = 0;
    const detections: { index: number; before: number; after: number; change: number }[] = [];
    const rows = track.signals.map(([wind, power], i) => {
      const current = numeric(power);
      const prev = i ? numeric(track.signals[i - 1][1]) : null;
      const adjacent = i > 0 && utc(track.stamps[i]) - utc(track.stamps[i - 1]) === 600000;
      if (adjacent && prev !== null && prev > 0 && current !== null && current >= 0) {
        const change = 100 * (prev - current) / prev;
        if (change >= 3) detections.push({ index: i, before: prev, after: current, change });
      }
      if (current !== null) {
        samples++;
        energy += current / 6; // Each sample is a ten-minute mean.
      }
      return { wind: numeric(wind), power: current, energy, samples, count: detections.length };
    });
    return { rows, detections };
  }, [track]);
  const row = series.rows[reading];
  const latest = series.detections.slice(Math.max(0, row.count - 3), row.count).reverse();
  const next = series.detections[row.count];
  const page = route.page;
  const evidence = <section className="rounded-xl border border-line bg-white p-5">
    <h2 className="font-semibold">Recorded power drops · {row.count}</h2>
    <p className="my-2 text-sm text-muted">Counts adjacent ten-minute readings where nonnegative output fell at least 3% from a positive previous reading. Wind changes can also cause a drop.</p>
    {latest.map(e => <p key={e.index} className="py-1 text-sm tabular-nums">{track.stamps[e.index]} · {fmt(e.before)} → {fmt(e.after)} {track.powerUnit} · down {fmt(e.change)}%</p>)}
    {!row.count && <p className="text-sm">No qualifying drop through this reading.</p>}
    {next && <button className="mt-3 rounded border px-3 py-1 text-sm" onClick={() => window.dispatchEvent(new CustomEvent("forewind:seek", { detail: next.index }))}>Jump to next recorded drop</button>}
  </section>;
  return <article className="page space-y-4">
    <h1 className="text-2xl font-semibold">{titles[page] ?? "Replay overview"}</h1>
    {fixture && <DeliveryGauge power={row.power} />}
    {page === "financial" && <section><h2 className="font-semibold">Energy across available intervals</h2>
      <p>{track.powerUnit === "kW" ? fmt(row.energy) + " kWh" : "Unavailable in kWh · CARE power uses source units"} · {row.samples} valid ten-minute averages.</p>
      <p className="text-sm text-muted">Revenue requires a tariff for the recorded period.</p></section>}
    {["technicians","task","home"].includes(page) && <p>Use the readings below for a field handoff. This dataset supplies no crew assignments or work orders.</p>}
    {page === "optimization" && <p>Recorded wind at this turbine was {fmt(row.wind)} m/s. The separate Thornton Bank panel shows the current offshore forecast.</p>}
    {page === "assistant" && <p>At {track.stamps[reading]}, this turbine recorded {fmt(row.wind)} m/s and {fmt(row.power)} {track.powerUnit}. Jump to a drop to inspect the pair of readings that triggered it.</p>}
    {!fixture && evidence}
    {["dashboard","reports","assets","engine","home"].includes(page) && <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-2 font-semibold">Recent turbine readings</h2>
      <table className="w-full text-left text-sm tabular-nums"><thead><tr><th>Sample time</th><th>Wind (m/s)</th><th>Power ({track.powerUnit})</th></tr></thead>
      <tbody>{series.rows.slice(Math.max(0, reading - 4), reading + 1).map((r,i,rows) => {
        const stamp = track.stamps[reading - rows.length + 1 + i];
        return <tr key={stamp}><td>{stamp}</td><td>{fmt(r.wind)}</td><td>{fmt(r.power)}</td></tr>;
      })}</tbody></table></section>}
    {page === "turbines" && !fixture && <HistoricalMetrics key={source} source={source} />}
    {page === "predictive" && !fixture && <><TrainingSources />
      <a className="block underline" href="#/senior/care-replay">Read the archived CARE event 40 report</a></>}
    {page === "predictive" && <WarehouseSignals />}
    {page === "optimization" && <WindForecast />}
  </article>;
}
