import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

function timestamp(value: string) {
  const iso = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : iso + "Z");
}

export function SignalReplay({ sourceName, stamps, children }: {
  sourceName: string;
  stamps: string[];
  children: (reading: number) => ReactNode;
}) {
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
  const next = times.findIndex(t => t > times[0] + position);
  const reading = next === -1 ? times.length - 1 : Math.max(0, next - 1);
  return <div className="space-y-3">
    <fieldset className="space-y-2 rounded border p-3">
      <legend className="px-1 font-semibold">{sourceName} · Historical signal replay</legend>
      <div className="flex flex-wrap items-center gap-4">
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
    {children(reading)}
  </div>;
}
