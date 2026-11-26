import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const eur = (n: number, compact = false) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(n);

export const num = (n: number, d = 1) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

export const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
export const fmtDateLong = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const fmtTimeSec = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const fmtDateTime = (ts: number) => `${fmtDate(ts)} ${fmtTime(ts)}`;

export function relTime(ts: number, now = Date.now()) {
  const s = Math.round((now - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export const hoursLabel = (h: number) => (h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} d`);
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const uid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 9)}`;
