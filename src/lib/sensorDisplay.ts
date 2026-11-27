// Use the first fractional reading for each channel. Startup zeros and counters
// should not force a fractional channel to display as whole numbers.
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const formats = Array.from({ length: 9 }, (_, digits) => new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false,
}));

export function sensorPrecision(name: string, readings: Iterable<string | null>) {
  if (/(?:^|[_\s])(?:id|name|code|status|state)(?:$|[_\s])/i.test(name)) return null;
  for (const raw of readings) {
    if (raw == null || raw.trim() === "") continue;
    if (!decimal.test(raw) || /^[-+]?0\d/.test(raw)) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const clean = Number(n.toPrecision(7));
    if (Number.isInteger(clean)) continue;
    const places = Math.max(0, -Math.floor(Math.log10(Math.abs(clean))) + 1);
    const limit = Math.min(8, Math.max(2, places));
    return Number(clean.toFixed(limit)).toFixed(limit).replace(/0+$/, "").split(".")[1]?.length || limit;
  }
  return 0;
}

export function sensorDisplay(raw: string | null, digits: number | null) {
  if (raw == null || raw.trim() === "") return "Missing at this time";
  if (digits === null || !decimal.test(raw)) return raw;
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) return raw;
  if (value !== 0 && Math.abs(value) < 0.5 * 10 ** -digits) return value.toExponential(1);
  return formats[digits].format(value === 0 ? 0 : value);
}
