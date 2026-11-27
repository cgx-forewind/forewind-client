import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Hour = { time: string; wind10mMs: number };
type Forecast = { hours: Hour[]; updatedAt: string };

export default function WindForecast() {
  const [forecast, setForecast] = useState<Forecast>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const response = await fetch("./api/weather/thornton-bank", { signal: controller.signal });
      if (!response.ok) throw new Error();
      setForecast(await response.json());
    }
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  return <Card>
    <CardHeader><CardTitle>Thornton Bank · forecast wind at 10 m</CardTitle></CardHeader>
    <CardContent>
      {forecast ? <>
        <div className="flex flex-wrap gap-5">{forecast.hours.filter((_, i) => i % 3 === 0).map(hour =>
          <div key={hour.time}><small>{hour.time.slice(5, 16).replace("T", " ")} UTC</small>
            <p>{hour.wind10mMs} m/s</p></div>)}</div>
        <p className="mt-3 text-sm">Model updated {forecast.updatedAt.replace("T", " ")} · <a href="https://api.met.no/weatherapi/locationforecast/2.0/">MET Norway</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
      </> : <p>{failed ? "Forecast unavailable." : "Loading forecast…"}</p>}
    </CardContent>
  </Card>;
}
