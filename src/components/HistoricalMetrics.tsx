import { memo, useEffect, useMemo, useState } from "react";
import { SignalReplay } from "@/components/SignalReplay";
import { sources } from "@/lib/trainingSources";
import { Card, CardContent } from "@/components/ui/card";

type Sample = { columns: string[]; rows: (string | null)[][]; trainingRows?: (string | null)[][]; file: string };
type Dataset = { source: string; timeColumn: string; turbines: Record<string, Sample> };

export function HistoricalMetrics({ source, trainingTurbine }: { source: string; trainingTurbine?: string }) {
  const [dataset, setDataset] = useState<Dataset>();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [id, setId] = useState("");

  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      async function json(file: string) {
        const res = await fetch(`./training/metrics/${file}.json`, { signal: controller.signal });
        if (!res.ok) throw new Error();
        return res.json();
      }
      const [data, headers]: [Dataset, string[][]] = await Promise.all([
        json(source), Promise.all(sources.map(s => json(s.id + ".columns"))),
      ]);
      const first = trainingTurbine ?? Object.keys(data.turbines)[0];
      if (data.source !== source || !data.turbines[first]?.rows.length) throw new Error();
      if (!controller.signal.aborted) {
        setCatalog([...new Set(headers.flat())]);
        setId(first);
        setDataset(data);
      }
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [source, trainingTurbine]);
  if (!dataset) return <p role="status">{failed ? "Historical readings unavailable." : "Loading readings…"}</p>;
  const sample = dataset.turbines[id];
  const rows = (id === trainingTurbine && sample.trainingRows) || sample.rows;
  return <Card><CardContent className="space-y-4 p-4">
    <h3 className="font-semibold">Sensor overview</h3>
    <div className="flex flex-wrap gap-4">
      <label>Turbine <select aria-label="Turbine" className="rounded border p-1" value={id} onChange={e => { setId(e.target.value); }}>
        {Object.keys(dataset.turbines).map(t => <option key={t}>{t}</option>)}
      </select></label>
      <label>Find column <input className="rounded border p-1" value={query} onChange={e => setQuery(e.target.value)} /></label>
    </div>
    <MetricTable key={id} sourceName={sources.find(s => s.id === source)?.name ?? source} sample={sample} rows={rows} catalog={catalog} timeColumn={dataset.timeColumn} query={query} />
  </CardContent></Card>;
}

type MetricProps = { sourceName: string; sample: Sample; rows: Sample["rows"]; catalog: string[]; timeColumn: string; query: string };

function MetricTable({ sourceName, sample, rows, catalog, timeColumn, query }: MetricProps) {
  const stamps = useMemo(() => {
    const index = sample.columns.indexOf(timeColumn);
    return rows.map(row => row[index] ?? "");
  }, [sample, rows, timeColumn]);
  const fields = useMemo(() => {
    const indices = new Map(sample.columns.map((name, index) => [name, index]));
    const names = [...sample.columns, ...catalog.filter(name => !indices.has(name))];
    return names.filter(name => name.toLowerCase().includes(query.trim().toLowerCase()))
      .map(name => ({ name, index: indices.get(name) }));
  }, [sample.columns, catalog, query]);
  return <SignalReplay sourceName={sourceName} stamps={stamps}>{reading =>
    <SensorValues fields={fields} row={rows[reading]} file={sample.file} />}
  </SignalReplay>;
}

const SensorValues = memo(function SensorValues({ fields, row, file }: {
  fields: { name: string; index: number | undefined }[]; row: (string | null)[]; file: string;
}) {
  return <section aria-label="Sensor values">
    <p className="break-all text-xs text-muted">{fields.length} matching column names · {file} · <a className="underline" href="./training/SOURCES.md">Data credits</a></p>
    <div className="max-h-96 overflow-auto">
      <table className="tbl w-full"><thead className="sticky top-0 bg-white"><tr><th scope="col">Source column</th><th scope="col">Recorded value</th></tr></thead>
        <tbody>{fields.map(({ name, index }) => <tr key={name} className="sensor-row">
          <th className="break-words text-left font-normal" scope="row">{name}</th>
          <td>{index === undefined ? "Column unavailable for this turbine" : row[index] ?? "Missing at this time"}</td>
        </tr>)}</tbody>
      </table>
      {fields.length === 0 && <p>No matching columns.</p>}
    </div>
  </section>;
});
