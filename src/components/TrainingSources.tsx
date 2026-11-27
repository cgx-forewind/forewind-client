import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { SignalReplay } from "@/components/SignalReplay";
import { sources } from "@/lib/trainingSources";

type Sample = { turbine: string; rows: [string, number, number][] };

function evaluate({ rows }: Sample) {
  const split = Math.floor(rows.length * 0.8);
  const bins = new Map<number, { count: number; total: number }>();
  for (const [, wind, power] of rows.slice(0, split)) {
    const key = Math.floor(wind);
    const bin = bins.get(key) ?? { count: 0, total: 0 };
    bin.total += power;
    bin.count++;
    bins.set(key, bin);
  }
  let error = 0, scored = 0;
  for (const [, wind, power] of rows.slice(split)) {
    const bin = bins.get(Math.floor(wind));
    if (bin) {
      error += Math.abs(power - bin.total / bin.count);
      scored++;
    }
  }
  return { split, scored, mae: scored ? error / scored : null };
}

function TrainingResult({ source }: { source: typeof sources[number] }) {
  const [data, setData] = useState<Sample>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const res = await fetch(`./training/${source.id}.json`, { signal: controller.signal });
      if (!res.ok) throw new Error();
      const sample: Sample = await res.json();
      if (!sample.rows?.length) throw new Error();
      setData(sample);
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [source.id]);
  const stamps = useMemo(() => data?.rows.map(row => row[0]) ?? [], [data]);
  if (!data) return <p role="status">{failed ? "Historical sample unavailable." : "Loading sample…"}</p>;
  const { split, scored, mae } = evaluate(data);
  const { rows } = data;
  return <div className="space-y-2">
    <SignalReplay sourceName={source.name} stamps={stamps}>{i =>
      <p className="tabular-nums">Wind speed: {rows[i][1]} m/s · Active power: {rows[i][2]} {source.unit}</p>}
    </SignalReplay>
    <p>Turbine {data.turbine} · {rows[0][0].slice(0, 10)} to {rows[rows.length - 1][0].slice(0, 10)}</p>
    <p>{split} training readings · {scored} of {rows.length - split} later readings scored</p>
    <p>Mean absolute power error: <strong>{mae === null ? "Unavailable" : `${mae.toPrecision(3)} ${source.unit}`}</strong></p>
    <a className="underline" href={source.url}>Source data</a> · <a className="underline" href="./training/SOURCES.md">Sample credits</a>
  </div>;
}

export function TrainingSources() {
  const [id, setId] = useState("care");
  const source = sources.find(s => s.id === id)!;
  return <Card>
    <CardHeader><CardTitle>Historical wind-to-power training</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <label>Training dataset <select className="rounded border p-1" value={id} onChange={e => setId(e.target.value)}>
        {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select></label>
      <p className="text-sm text-muted">Fit average power per 1 m/s wind band on the earliest 80% of the sample. Score later readings in wind bands seen during training.</p>
      <TrainingResult key={id} source={source} />
    </CardContent>
  </Card>;
}
