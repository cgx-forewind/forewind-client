import { memo, useEffect, useMemo, useState } from "react";
import { pilotSeries } from "@/lib/pilotMetrics";
import { currentReplaySelection, SignalReplay } from "@/components/SignalReplay";
import { sources, replaySelection } from "@/lib/trainingSources";
import { Card, CardContent } from "@/components/ui/card";

type Sample = { columns: string[]; rows: (string | null)[][]; trainingRows?: (string | null)[][]; file: string };
type Dataset = { source: string; timeColumn: string; turbines: Record<string, Sample> };

export function HistoricalMetrics({ source, trainingTurbine }: { source: string; trainingTurbine?: string }) {
  const [dataset, setDataset] = useState<Dataset>();
  const [failed, setFailed] = useState(false);
  const [id, setId] = useState("");

  const selectionKey = source + (trainingTurbine ? ":training" : ":directory");
  const [window, setWindow] = useState<"sample" | "training">("sample");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const response = await fetch(`./training/metrics/${source}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error();
      const data: Dataset = await response.json();
      const active = currentReplaySelection();
      const previous = active.source === source ? active.turbine : replaySelection.turbines.get(selectionKey);
      const first = previous && data.turbines[previous] ? previous : trainingTurbine ?? Object.keys(data.turbines)[0];
      if (data.source !== source || !data.turbines[first]?.rows.length) throw new Error();
      if (!controller.signal.aborted) {
        setWindow((active.source === source && first === active.turbine ? active.window === "training" : first === trainingTurbine) ? "training" : "sample");
        setId(first);
        setDataset(data);
      }
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [source, trainingTurbine, selectionKey]);
  if (!dataset) return <p role="status">{failed ? "Historical readings unavailable." : "Loading readings…"}</p>;
  const sample = dataset.turbines[id];
  const rows = (window === "training" && sample.trainingRows) || sample.rows;
  return <Card><CardContent className="space-y-4 p-4">
    <h3 className="font-semibold">Sensor overview</h3>
    <div className="flex flex-wrap gap-4">
      <label>Turbine <select aria-label="Turbine" className="rounded border p-1" value={id} onChange={e => { replaySelection.turbines.set(selectionKey, e.target.value); setWindow(e.target.value === trainingTurbine ? "training" : "sample"); setId(e.target.value); }}>
        {Object.keys(dataset.turbines).map(t => <option key={t}>{t}</option>)}
      </select></label>
      <label>Find column <input className="rounded border p-1" value={query} onChange={e => setQuery(e.target.value)} /></label>
    </div>
    <MetricTable key={id} source={source} turbine={id} sourceName={sources.find(s => s.id === source)?.name ?? source} sample={sample} rows={rows} timeColumn={dataset.timeColumn} query={query} />
  </CardContent></Card>;
}

type MetricProps = { source: string; turbine: string; sourceName: string; sample: Sample; rows: Sample["rows"]; timeColumn: string; query: string };

function MetricTable({ source, turbine, sourceName, sample, rows, timeColumn, query }: MetricProps) {
  const stamps = useMemo(() => {
    const index = sample.columns.indexOf(timeColumn);
    return rows.map(row => row[index] ?? "");
  }, [sample, rows, timeColumn]);
  const signals = useMemo(() => {
    const windColumn = source === "care" ? "wind_speed_3_avg" : source === "la-haute-borne" ? "Ws_avg" : "Wind speed (m/s)";
    const powerColumn = source === "care" ? "power_30_avg" : source === "la-haute-borne" ? "P_avg" : "Power (kW)";
    const wind = sample.columns.indexOf(windColumn);
    const power = sample.columns.indexOf(powerColumn);
    return rows.map(row => [row[wind] ?? null, row[power] ?? null] as const);
  }, [rows, sample.columns, source]);
  const metrics = useMemo(() => pilotSeries(source, turbine, sample.columns, rows, stamps), [source, turbine, sample.columns, rows, stamps]);
  const availableFields = useMemo(() => {
    const hasReading = (value: string | null | undefined) => value != null && value.trim() !== "";
    return sample.columns.map((name, index) => ({ name, index })).filter(({ index }) =>
      sample.rows.some(row => hasReading(row[index])) ||
      sample.trainingRows?.some(row => hasReading(row[index])));
  }, [sample]);
  const fields = availableFields.filter(({ name }) => name.toLowerCase().includes(query.trim().toLowerCase()));
  return <SignalReplay trackKey={source + ":" + turbine + ":" + (rows === sample.trainingRows ? "training" : "sample")} sourceName={sourceName + " · Turbine " + turbine} stamps={stamps} signals={signals} powerUnit={sources.find(s => s.id === source)!.unit}>{reading => <>
    <section aria-label="Derived metrics">
      <h4 className="font-semibold">Derived metrics</h4>
      <table className="tbl w-full"><thead><tr><th>Metric</th><th>Value</th><th>Inputs or availability</th></tr></thead>
        <tbody>{(["giz1", "simi1", "shipi1", "lazer1"] as const).map(name => {
          const { value, detail } = metrics[reading][name];
          const label = { giz1: "Delivery ratio", simi1: "Inverse tip-speed ratio", shipi1: "Wind per kelvin", lazer1: "Weekly delivery vs baseline" }[name];
          const unit = { giz1: "", simi1: "", shipi1: " m/(s·K)", lazer1: "%" }[name];
          return <tr className="sensor-row" key={name} title={detail}><th scope="row">{name} · {label}</th>
            <td>{value === null ? "Unavailable" : value.toLocaleString("en-GB", { maximumSignificantDigits: 5 }) + unit}</td><td>{detail}</td></tr>;
        })}</tbody>
      </table>
      <p className="text-xs text-muted">Earlier Giz v0 · Farm C turbine 21 · <a className="underline" href="https://github.com/ChicoShi/cgx-hackathon-2026/blob/main/reports/giz_weekly.csv">49 historical weekly brake-pressure ratios</a></p>
    </section>
    <SensorValues fields={fields} row={rows[reading]} file={sample.file} /></>}
  </SignalReplay>;
}

const SensorValues = memo(function SensorValues({ fields, row, file }: {
  fields: { name: string; index: number }[]; row: (string | null)[]; file: string;
}) {
  return <section aria-label="Sensor values">
    <p className="break-all text-xs text-muted">{fields.length} matching column names · {file} · <a className="underline" href="./training/SOURCES.md">Data credits</a></p>
    <div className="max-h-96 overflow-auto">
      <table className="tbl w-full"><thead className="sticky top-0 bg-white"><tr><th scope="col">Source column</th><th scope="col">Recorded value</th></tr></thead>
        <tbody>{fields.map(({ name, index }) => <tr key={name} className="sensor-row">
          <th className="break-words text-left font-normal" scope="row">{name}</th>
          <td>{row[index]?.trim() || "Missing at this time"}</td>
        </tr>)}</tbody>
      </table>
      {fields.length === 0 && <p>No matching columns.</p>}
    </div>
  </section>;
});
