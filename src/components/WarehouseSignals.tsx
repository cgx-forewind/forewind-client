import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function WarehouseSignals() {
  const [rows, setRows] = useState<(string | null)[][]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setBusy(true);
    setRows([]);
    setMessage("");
    try {
      const response = await fetch("./api/warehouse/signals", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.rows)) throw new Error(data.error || "Invalid response");
      setRows(data.rows);
      setMessage(data.rows.length ? "" : "The configured source returned no readings.");
    } catch (error) {
      setMessage(error instanceof SyntaxError ? "Warehouse service unavailable." : String((error as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return <Card>
    <CardHeader><CardTitle>Diggibyte warehouse readings</CardTitle>
      <Button disabled={busy} onClick={load}>{busy ? "Loading…" : "Load latest 20"}</Button>
    </CardHeader>
    <CardContent>
      <p role="status">{message}</p>
      {rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr>{["Time", "Turbine", "Signal", "Value"].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value ?? "—"}</td>)}</tr>)}</tbody>
      </table></div>}
    </CardContent>
  </Card>;
}
