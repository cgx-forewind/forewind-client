const source = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=51.55&lon=2.95";
let forecast, modified, expires = 0, pending;

async function refresh() {
  const headers = { "User-Agent": "Forewind/0.1 (https://github.com/cgx-forewind/forewind-client)" };
  if (modified) headers["If-Modified-Since"] = modified;
  const response = await fetch(source, { headers, signal: AbortSignal.timeout(8000) });
  if (response.status !== 304) {
    if (!response.ok) throw new Error("Weather service unavailable");
    const { meta, timeseries } = (await response.json()).properties;
    const hours = timeseries.slice(0, 24).map(({ time, data }) => ({
      time, wind10mMs: data.instant.details.wind_speed,
      directionFromDeg: data.instant.details.wind_from_direction,
      airTempC: data.instant.details.air_temperature,
    }));
    if (!hours.length || hours.some(h => !Number.isFinite(h.wind10mMs))) throw new Error("Incomplete forecast");
    forecast = { site: "Thornton Bank", latitude: 51.55, longitude: 2.95, provider: "MET Norway",
      source, license: "https://creativecommons.org/licenses/by/4.0/", updatedAt: meta.updated_at, hours };
    modified = response.headers.get("last-modified");
  }
  expires = Math.max(Date.now() + 60000, Date.parse(response.headers.get("expires")) || 0);
  return forecast;
}

export function getWind() {
  if (Date.now() < expires) return forecast;
  pending ??= refresh().finally(() => { pending = undefined; });
  return pending;
}
