import { useEffect, useMemo, useRef, useState } from "react";
import { sources } from "@/lib/trainingSources";
import { Card, CardContent } from "@/components/ui/card";

type Sample = { columns: string[]; rows: (string | null)[][]; file: string };
type Dataset = { source: string; timeColumn: string; turbines: Record<string, Sample> };

export function HistoricalMetrics({ source }: { source: string }) {
  const [dataset, setDataset] = useState<Dataset>();
  const [failed, setFailed] = useState(false);
  const [id, setId] = useState("");

  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetch(`./training/metrics/${source}.json`, { signal: controller.signal });
      if (!res.ok) throw new Error();
      const data: Dataset = await res.json();
      const first = Object.keys(data.turbines)[0];
      if (data.source !== source || !data.turbines[first]?.rows.length) throw new Error();
      if (!controller.signal.aborted) {
        setId(first);
        setDataset(data);
      }
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [source]);
  if (!dataset) return <p role="status">{failed ? "Historical readings unavailable." : "Loading readings…"}</p>;
  const sample = dataset.turbines[id];
  return <Card><CardContent className="space-y-4 p-4">
    <div className="flex flex-wrap gap-4">
      <label>Turbine <select aria-label="Turbine" className="rounded border p-1" value={id} onChange={e => { setId(e.target.value); }}>
        {Object.keys(dataset.turbines).map(t => <option key={t}>{t}</option>)}
      </select></label>
      <label>Find column <input className="rounded border p-1" value={query} onChange={e => setQuery(e.target.value)} /></label>
    </div>
    <SignalReplay key={id} sourceName={sources.find(s => s.id === source)?.name ?? source} sample={sample} timeColumn={dataset.timeColumn} query={query} />
  </CardContent></Card>;
}

function timestamp(value: string) {
  const iso = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : iso + "Z");
}

function SignalReplay({ sourceName, sample, timeColumn, query }: { sourceName: string; sample: Sample; timeColumn: string; query: string }) {
  const stamp = sample.columns.indexOf(timeColumn);
  const times = useMemo(() => sample.rows.map(row => timestamp(row[stamp] ?? "")), [sample, stamp]);
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
  const next = times.findIndex(t => t > times[0] + position);
  const reading = next === -1 ? times.length - 1 : Math.max(0, next - 1);
  const fields = sample.columns.map((name, index) => ({ name, index }))
    .filter(({ name }) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="space-y-3">
    <fieldset className="space-y-2 rounded border p-3">
      <legend className="px-1 font-semibold">{sourceName} · Historical signal replay</legend>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="rounded border px-3 py-1" disabled={!(duration > 0)} onClick={() => {
          if (!playing && position >= duration) seek(0);
          setPlaying(!playing);
        }}>{playing ? "Pause" : position >= duration ? "Replay" : "Play"}</button>
        <label>Speed <select aria-label="Replay speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
          <option value={1}>1× real time</option><option value={60}>60×</option><option value={600}>600×</option>
        </select></label>
      <label>Sample time <select aria-label="Sample time" className="rounded border p-1" value={reading} onChange={e => seek(times[Number(e.target.value)] - times[0])}>
        {sample.rows.map((row, i) => <option key={i} value={i}>{row[stamp]}</option>)}
      </select></label>
      </div>
      <input aria-label="Replay position" aria-valuetext={sample.rows[reading][stamp] ?? undefined} className="w-full" type="range" min={0} max={duration} step={1000} value={position} onChange={e => seek(Number(e.target.value))} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span>{sample.rows[0][stamp]}</span><span>Reading {reading + 1} of {times.length}</span><span>{sample.rows[times.length - 1][stamp]}</span></div>
    </fieldset>
    <p className="break-all text-xs text-muted">{fields.length} of {sample.columns.length} source columns · {sample.file} · <a className="underline" href="./training/SOURCES.md">Data credits</a></p>
    <table className="tbl w-full"><thead><tr><th scope="col">Source column</th><th scope="col">Recorded value</th></tr></thead>
      <tbody>{fields.map(({ name, index }) => <tr key={index}><th className="break-words text-left font-normal" scope="row">{name}</th><td>{sample.rows[reading][index] ?? "Missing"}</td></tr>)}</tbody>
    </table>
  </div>;
}
