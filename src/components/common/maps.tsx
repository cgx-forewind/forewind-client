import { useState } from "react";
import { Truck, Plane, Wrench } from "lucide-react";
import type { Technician, TurbineView } from "@/types";
import { riskColor } from "@/lib/tokens";
import { cn, pct, num } from "@/lib/utils";
import { RiskBadge } from "./bits";

/** Schematic wind-farm map (synthetic layout; no external map tiles — keeps the app Databricks-only). */
export function WindFarmMap({ fleet, onSelect, selectedId, techs, route, height = 340 }: {
  fleet: TurbineView[]; onSelect?: (id: string) => void; selectedId?: string; techs?: Technician[];
  route?: { techId: string; turbineId: string } | null; height?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const hv = fleet.find((t) => t.id === hover);
  const rt = route ? { t: techs?.find((x) => x.id === route.techId), tb: fleet.find((x) => x.id === route.turbineId) } : null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-[#F1F6FC] to-[#E8F0F9]" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="#DCE6F2" strokeWidth="0.15" /></pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        <path d="M0 62 C 20 55, 35 70, 55 60 S 85 48, 100 56" fill="none" stroke="#CFDDEE" strokeWidth="0.7" />
        <path d="M0 33 C 25 38, 40 28, 62 34 S 90 30, 100 36" fill="none" stroke="#CFDDEE" strokeWidth="0.7" />
        <path d="M6 100 C 12 70, 20 40, 44 0" fill="none" stroke="#D5E0EE" strokeWidth="0.5" strokeDasharray="1.5 1" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" role="group" aria-label="Wind farm map">
        {rt?.t && rt.tb && (
          <line x1={rt.t.x} y1={rt.t.y} x2={rt.tb.x} y2={rt.tb.y} stroke="#7C3AED" strokeWidth="0.5" strokeDasharray="1.4 1" className="animate-fadeIn" />
        )}
        {fleet.map((t) => {
          const c = t.status === "offline" ? "#94A3B8" : t.status === "maintenance" ? "#3B82F6" : riskColor[t.risk];
          const sel = selectedId === t.id;
          const hot = t.risk === "red" && t.status !== "maintenance";
          return (
            <g key={t.id} transform={`translate(${t.x} ${t.y})`} className="cursor-pointer" tabIndex={0} role="button" aria-label={`${t.id}, ${t.risk} risk, ${t.status}`}
              onClick={() => onSelect?.(t.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(t.id)}
              onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(t.id)} onBlur={() => setHover(null)}>
              {hot && <circle r="3" fill={c} opacity="0.35"><animate attributeName="r" values="1.8;5;1.8" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.5;0;0.5" dur="1.6s" repeatCount="indefinite" /></circle>}
              {sel && <circle r="3.4" fill="none" stroke="#0F172A" strokeWidth="0.4" />}
              <circle r="2" fill="#fff" stroke={c} strokeWidth="0.9" />
              <g stroke={c} strokeWidth="0.5" strokeLinecap="round"><path d="M0 0V-1.5M0 0L1.3 .75M0 0L-1.3 .75" /></g>
              <text y="5.4" textAnchor="middle" fontSize="2.1" fill="#64748B" style={{ fontWeight: 600 }}>{t.id.replace("WT-", "")}</text>
            </g>
          );
        })}
        {techs?.map((t) => (
          <g key={t.id} transform={`translate(${t.x} ${t.y})`}>
            <rect x="-1.7" y="-1.7" width="3.4" height="3.4" rx="0.8" fill={t.status === "off_shift" ? "#CBD5E1" : "#7C3AED"} />
            <text y="0.75" textAnchor="middle" fontSize="2.1" fill="#fff" style={{ fontWeight: 700 }}>{t.name.split(" ").map((x) => x[0]).join("")}</text>
          </g>
        ))}
      </svg>
      {hv && (
        <div className="pointer-events-none absolute left-3 top-3 w-52 rounded-lg border border-line bg-white/95 p-2.5 text-xs shadow-pop backdrop-blur">
          <div className="flex items-center justify-between"><b>{hv.id}</b><RiskBadge risk={hv.risk} /></div>
          <div className="mt-1 text-muted">{hv.site} · {hv.status}</div>
          <div className="mt-1 tabular-nums">Risk {pct(hv.riskScore)} · {num(hv.sensors.temp)} °C · {num(hv.sensors.vibration)} mm/s</div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-white/85 px-2 py-1 text-[10px] text-muted backdrop-blur">
        {[["Healthy", "#16A34A"], ["Degrading", "#F59E0B"], ["Critical", "#DC2626"], ["Maintenance", "#3B82F6"], ["Offline", "#94A3B8"]].map(([l, c]) => (
          <span key={l} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
        ))}
        {techs && <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-ai" />Technician</span>}
      </div>
      <span className="absolute right-2 top-2 rounded border border-dashed border-slate-300 bg-white/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted">Schematic · simulated</span>
    </div>
  );
}

export function TransportIcon({ t, className }: { t: Technician["transport"]; className?: string }) {
  const I = t === "Helicopter transfer" ? Plane : t === "4x4 pickup" ? Wrench : Truck;
  return <I className={cn("h-3.5 w-3.5", className)} aria-hidden />;
}
