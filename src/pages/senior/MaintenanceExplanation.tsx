import { useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MaintWindow } from "@/types";

const copy = {
  en: ["Why this maintenance window?", "Compare simulated slots using the hub worker", "Comparing windows…", "Still thinking. Click to check again.", "Explanation unavailable. Click to retry."],
  de: ["Warum dieses Wartungsfenster?", "Simulierte Termine über den Hub vergleichen", "Termine werden verglichen …", "Noch in Bearbeitung. Erneut klicken zum Prüfen.", "Erklärung nicht verfügbar. Erneut versuchen."],
};
type Run = () => Promise<{ status: "done"; text: string } | { status: "failed" }>;

export default function MaintenanceExplanation({ windows }: { windows: MaintWindow[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const run = useRef<Run>();
  const labels = navigator.language.startsWith("de") ? copy.de : copy.en;

  async function explain() {
    setBusy(true);
    setMessage(labels[2]);
    try {
      if (!run.current) {
        const path = "/explain-alert.js";
        const client = await import(/* @vite-ignore */ path);
        const candidates = windows.map(({id, start, end, durationH, lostRevenue, safetyMarginH, checks}) =>
          ({id, start, end, durationH, lostRevenue, safetyMarginH, checks}));
        run.current = client.createAlertExplanation({
          turbine_id: windows[0].turbineId, simulated: true, candidates,
        }, "maintenance_window") as Run;
      }
      const job = await run.current();
      if (job.status === "done") {
        setMessage(job.text);
        setDone(true);
      } else {
        run.current = undefined;
        setMessage(labels[4]);
      }
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "TimeoutError" ? labels[3] : labels[4]);
    } finally {
      setBusy(false);
    }
  }
  return <section>
    <Button variant="outline" title={labels[1]} disabled={busy || done} onClick={explain}>
      <CalendarClock aria-hidden="true" className="h-4 w-4" /> {labels[0]}
    </Button>
    <p role="status" className="mt-2 text-sm">{message}</p>
  </section>;
}
