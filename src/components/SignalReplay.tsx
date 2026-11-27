import { sources } from "@/lib/trainingSources";

import { create } from "zustand";
import defaultSample from "../../public/training/care.json";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

function timestamp(value: string) {
  const iso = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : iso + "Z");
}

type Signals = readonly [string | number | null, string | number | null];
type Track = { key: string; sourceName: string; stamps: string[]; signals: Signals[]; powerUnit: string };

export const useReplay = create<{ track: Track; reading: number; simulation: boolean }>(() => ({
  track: { key: "care:10:training", sourceName: "CARE · Farm A · Turbine 10", powerUnit: "source units", signals: defaultSample.rows.map(r => [r[1], r[2]]), stamps: defaultSample.rows.map(r => String(r[0])) },
  reading: 0, simulation: false,
}));

export function useReplayDataset(includeSimulation = false) {
  return useReplay(s => includeSimulation && s.simulation ? "simulation" : s.track.key.split(":")[0]);
}

function DatasetPicker() {
  const selected = useReplayDataset(true);
  const request = useRef(0);
  const [pending, setPending] = useState("");
  const [error, setError] = useState(false);

  async function choose(id: string) {
    const version = ++request.current;
    setError(false);
    setPending("");
    if (id === "simulation") {
      useReplay.setState({ simulation: true });
      return;
    }
    if (id === "delivery-test") {
      const power = [1000, 1000, 990, 980, 970, 970];
      useReplay.setState({ simulation: false, reading: 0, track: {
        key: "delivery-test:T1:sample", sourceName: "Delivery test · T1", powerUnit: "kW",
        stamps: power.map((_, i) => new Date(Date.UTC(2020, 0, 1, 0, i * 10)).toISOString()),
        signals: power.map(value => [8, value]),
      } });
      return;
    }
    if (currentReplaySelection().source === id) {
      useReplay.setState({ simulation: false });
      return;
    }
    setPending(id);
    try {
      const source = sources.find(s => s.id === id)!;
      const response = await fetch(`./training/${id}.json`);
      if (!response.ok) throw new Error();
      const sample: { turbine: string; rows: [string, number, number][] } = await response.json();
      if (!sample.rows.length) throw new Error();
      if (version === request.current) {
        useReplay.setState({ track: { key: `${id}:${sample.turbine}:training`,
          sourceName: `${source.name} · Turbine ${sample.turbine}`, powerUnit: source.unit, signals: sample.rows.map(row => [row[1], row[2]]), stamps: sample.rows.map(row => row[0]) },
          reading: 0, simulation: false });
      }
    } catch {
      if (version === request.current) setError(true);
    } finally {
      if (version === request.current) setPending("");
    }
  }
  return <label className="text-xs">Dataset <select aria-label="Dataset" className="rounded border p-1" value={pending || selected} onChange={e => void choose(e.target.value)}>
    <option value="simulation">Simulated fleet</option>
    <option value="delivery-test">Delivery test · 100% → 97%</option>
    {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
  </select>{error && <span role="status"> Dataset unavailable.</span>}</label>;
}

export function currentReplaySelection() {
  const [source, turbine, window] = useReplay.getState().track.key.split(":");
  return { source, turbine, window };
}

export function SignalReplay({ trackKey, sourceName, stamps, signals, powerUnit, children }: {
  trackKey: string;
  sourceName: string;
  stamps: string[];
  signals: Signals[];
  powerUnit: string;
  children: (reading: number) => ReactNode;
}) {
  const reading = useReplay(s => s.track.key === trackKey ? s.reading : 0);
  useLayoutEffect(() => {
    if (useReplay.getState().track.key !== trackKey) {
      useReplay.setState({ track: { key: trackKey, sourceName, stamps, signals, powerUnit }, reading: 0 });
    }
  }, [trackKey, sourceName, stamps, signals, powerUnit]);
  return <>{children(reading)}</>;
}

export function ReplayReadings() {
  const track = useReplay(s => s.track);
  const reading = useReplay(s => s.reading);
  const [wind, power] = track.signals[reading];
  const format = (value: Signals[number], unit: string) => value === null
    ? "Unavailable" : Number(value).toLocaleString("en-GB", { maximumSignificantDigits: 5 }) + " " + unit;
  return <section aria-label="Historical replay readings" className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-white px-4 py-2 text-sm tabular-nums">
    <div><strong>{track.sourceName}</strong><p className="text-xs text-muted">{track.key.startsWith("delivery-test:") ? "Synthetic fixture" : "Historical replay"} · {track.stamps[reading]}</p></div>
    <dl className="flex flex-wrap gap-x-6">
      <div><dt className="text-xs text-muted">Wind speed</dt><dd>{format(wind, "m/s")}</dd></div>
      <div><dt className="text-xs text-muted">Active power</dt><dd>{format(power, track.powerUnit)}</dd></div>
    </dl>
  </section>;
}

export function ReplayFooter() {
  const track = useReplay(s => s.track);
  const simulation = useReplay(s => s.simulation);
  const footer = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = footer.current!;
    const resize = () => document.documentElement.style.setProperty("--replay-height", el.offsetHeight + "px");
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <footer ref={footer} aria-label="Historical playback" className="replay-footer no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white px-3 pt-1 shadow-pop">
    <div className="mx-auto max-w-[1400px]"><DatasetPicker /></div>
    {!simulation && <Controls key={track.key} sourceName={track.sourceName} stamps={track.stamps} />}
  </footer>;
}

function Controls({ sourceName, stamps }: Pick<Track, "sourceName" | "stamps">) {
  const times = useMemo(() => stamps.map(timestamp), [stamps]);
  const options = useMemo(() => stamps.map((stamp, i) => <option key={i} value={i}>{stamp}</option>), [stamps]);
  const duration = times[times.length - 1] - times[0];
  const [position, setPosition] = useState(0);
  const cursor = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  function seek(ms: number) {
    cursor.current = ms;
    setPosition(ms);
  }
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const next = Math.min(duration, cursor.current + (now - previous) * speed);
      previous = now;
      seek(next);
      if (next >= duration) setPlaying(false);
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, speed, duration]);
  useEffect(() => {
    const jump = (event: Event) => {
      const index = (event as CustomEvent<number>).detail;
      if (Number.isInteger(index) && times[index] !== undefined) {
        setPlaying(false);
        seek(times[index] - times[0]);
      }
    };
    window.addEventListener("forewind:seek", jump);
    return () => window.removeEventListener("forewind:seek", jump);
  }, [times]);
  const next = times.findIndex(t => t > times[0] + position);
  const reading = next === -1 ? times.length - 1 : Math.max(0, next - 1);
  useLayoutEffect(() => { useReplay.setState({ reading }); }, [reading]);
  return <>
    <fieldset className="mx-auto max-w-[1400px] min-w-0 text-xs">
      <legend className="px-1 font-semibold">{sourceName} · Signal replay</legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" className="rounded border px-3 py-1" disabled={!(duration > 0)} onClick={() => {
          if (!playing && position >= duration) seek(0);
          setPlaying(!playing);
        }}>{playing ? "Pause" : position >= duration ? "Replay" : "Play"}</button>
        <label>Speed <select aria-label="Replay speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
          <option value={1}>1× real time</option><option value={60}>60×</option><option value={600}>600×</option><option value={6000}>6000×</option>
        </select></label>
      <label>Sample time <select aria-label="Sample time" className="rounded border p-1" value={reading} onChange={e => seek(times[Number(e.target.value)] - times[0])}>
        {options}
      </select></label>
      </div>
      <input aria-label="Replay position" aria-valuetext={stamps[reading]} className="w-full" type="range" min={0} max={duration} step={1000} value={position} onChange={e => seek(Number(e.target.value))} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span>{stamps[0]}</span><span>Reading {reading + 1} of {times.length} · {duration > 0 ? Math.floor(position / duration * 100) : 0}%</span><span>{stamps[times.length - 1]}</span></div>
    </fieldset>
  </>;
}
