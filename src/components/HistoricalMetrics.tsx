import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

type Sample = { columns: string[]; rows: (string | null)[][]; file: string };
type Dataset = { source: string; timeColumn: string; turbines: Record<string, Sample> };

export function HistoricalMetrics({ source }: { source: string }) {
  const [dataset, setDataset] = useState<Dataset>();
  const [failed, setFailed] = useState(false);
  const [id, setId] = useState("");
  const [reading, setReading] = useState(0);
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
  const stamp = sample.columns.indexOf(dataset.timeColumn);
  const fields = sample.columns.map((name, index) => ({ name, index }))
    .filter(({ name }) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return <Card><CardContent className="space-y-4 p-4">
    <div className="flex flex-wrap gap-4">
      <label>Turbine <select aria-label="Turbine" className="rounded border p-1" value={id} onChange={e => { setId(e.target.value); setReading(0); }}>
        {Object.keys(dataset.turbines).map(t => <option key={t}>{t}</option>)}
      </select></label>
      <label>Sample time <select aria-label="Sample time" className="rounded border p-1" value={reading} onChange={e => setReading(Number(e.target.value))}>
        {sample.rows.map((row, i) => <option key={i} value={i}>{row[stamp]}</option>)}
      </select></label>
      <label>Find column <input className="rounded border p-1" value={query} onChange={e => setQuery(e.target.value)} /></label>
    </div>
    <p className="break-all text-xs text-muted">{fields.length} of {sample.columns.length} source columns · {sample.file} · <a className="underline" href="./training/SOURCES.md">Data credits</a></p>
    <table className="tbl w-full"><thead><tr><th scope="col">Source column</th><th scope="col">Recorded value</th></tr></thead>
      <tbody>{fields.map(({ name, index }) => <tr key={index}><th className="break-words text-left font-normal" scope="row">{name}</th><td>{sample.rows[reading][index] ?? "Missing"}</td></tr>)}</tbody>
    </table>
  </CardContent></Card>;
}
