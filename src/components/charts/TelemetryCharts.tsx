import { memo, useMemo, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import type { TelemetryPoint } from "@/types";
import { tokens } from "@/lib/tokens";
import { RESIDUAL_SIGMA } from "@/engine/telemetry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Legend } from "@/components/common/bits";

const fmtX = (ts: number) => new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit" }).replace(",", "");
const axis = { stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false } as const;

function Tip({ active, payload, label, unit, digits = 1 }: { active?: boolean; payload?: { name: string; value: number | number[]; color: string }[]; label?: number; unit?: string; digits?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-navy">{new Date(label!).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
      {payload.filter((p) => !Array.isArray(p.value)).map((p) => (
        <p key={p.name} className="flex items-center gap-2 tabular-nums"><i className="h-2 w-2 rounded-full" style={{ background: p.color }} /><span className="text-muted">{p.name}</span><b className="ml-auto pl-3">{(p.value as number).toFixed(digits)}{unit}</b></p>
      ))}
    </div>
  );
}

export function ChartCard({ title, desc, legend, children, h = 200 }: { title: string; desc?: string; legend?: { color: string; label: string; dashed?: boolean }[]; children: ReactNode; h?: number }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div><CardTitle>{title}</CardTitle>{desc && <CardDescription className="mt-0.5">{desc}</CardDescription>}</div>
      </CardHeader>
      <CardContent>
        {legend && <div className="mb-2"><Legend items={legend} /></div>}
        <div style={{ height: h }} role="img" aria-label={`${title} chart`}>
          <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

const common = { syncId: "tele", margin: { top: 6, right: 8, bottom: 0, left: -12 } };
const xa = <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fmtX} minTickGap={48} {...axis} />;
const grid = <CartesianGrid stroke="#EEF2F7" vertical={false} />;

export const TelemetryCharts = memo(function TelemetryCharts({ data }: { data: TelemetryPoint[] }) {
  const band = useMemo(() => data.map((d) => ({ ...d, band: [d.expected - 2 * RESIDUAL_SIGMA, d.expected + 2 * RESIDUAL_SIGMA] as [number, number], rband: [d.riskLo, d.riskHi] as [number, number] })), [data]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Bearing temperature" desc="Measured main-bearing temperature" legend={[{ color: tokens.primary, label: "Measured" }, { color: tokens.warn, label: "Warning 70 °C", dashed: true }]}>
        <LineChart data={data} {...common}>{grid}{xa}<YAxis {...axis} domain={["auto", "auto"]} unit="°" /><Tooltip content={<Tip unit=" °C" />} />
          <ReferenceLine y={70} stroke={tokens.warn} strokeDasharray="4 3" />
          <Line name="Measured" dataKey="temp" stroke={tokens.primary} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
      </ChartCard>
      <ChartCard title="Expected vs measured temperature" desc="Load- and ambient-adjusted expectation with ±2σ band" legend={[{ color: tokens.primary, label: "Measured" }, { color: tokens.muted, label: "Expected (model)", dashed: true }, { color: "#CBD5E1", label: "±2σ band" }]}>
        <ComposedChart data={band} {...common}>{grid}{xa}<YAxis {...axis} domain={["auto", "auto"]} unit="°" /><Tooltip content={<Tip unit=" °C" />} />
          <Area name="band" dataKey="band" stroke="none" fill="#CBD5E1" fillOpacity={0.4} isAnimationActive={false} legendType="none" tooltipType="none" />
          <Line name="Expected" dataKey="expected" stroke={tokens.muted} strokeDasharray="5 3" strokeWidth={1.6} dot={false} isAnimationActive={false} />
          <Line name="Measured" dataKey="temp" stroke={tokens.primary} strokeWidth={2} dot={false} isAnimationActive={false} /></ComposedChart>
      </ChartCard>
      <ChartCard title="Temperature residual" desc="Measured − expected (°C). Dashed: 2σ and 3σ" legend={[{ color: tokens.ai, label: "Residual" }, { color: tokens.warn, label: "2σ", dashed: true }, { color: tokens.crit, label: "3σ", dashed: true }]}>
        <AreaChart data={data} {...common}>{grid}{xa}<YAxis {...axis} unit="°" /><Tooltip content={<Tip unit=" °C" />} />
          <ReferenceLine y={2 * RESIDUAL_SIGMA} stroke={tokens.warn} strokeDasharray="4 3" /><ReferenceLine y={3 * RESIDUAL_SIGMA} stroke={tokens.crit} strokeDasharray="4 3" />
          <Area name="Residual" dataKey="residual" stroke={tokens.ai} fill={tokens.ai} fillOpacity={0.14} strokeWidth={2} dot={false} isAnimationActive={false} /></AreaChart>
      </ChartCard>
      <ChartCard title="Vibration" desc="RMS velocity, mm/s" legend={[{ color: "#0EA5E9", label: "Vibration" }, { color: tokens.warn, label: "Alert 4.5", dashed: true }, { color: tokens.crit, label: "Danger 7.1", dashed: true }]}>
        <LineChart data={data} {...common}>{grid}{xa}<YAxis {...axis} domain={[0, 9]} /><Tooltip content={<Tip unit=" mm/s" />} />
          <ReferenceLine y={4.5} stroke={tokens.warn} strokeDasharray="4 3" /><ReferenceLine y={7.1} stroke={tokens.crit} strokeDasharray="4 3" />
          <Line name="Vibration" dataKey="vibration" stroke="#0EA5E9" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart>
      </ChartCard>
      <ChartCard title="Rotor speed" desc="Main shaft, rpm">
        <LineChart data={data} {...common}>{grid}{xa}<YAxis {...axis} domain={[0, 16]} /><Tooltip content={<Tip unit=" rpm" />} />
          <Line name="Rotor speed" dataKey="rpm" stroke="#14B8A6" strokeWidth={1.8} dot={false} isAnimationActive={false} /></LineChart>
      </ChartCard>
      <ChartCard title="Generated power" desc="Active power, kW">
        <AreaChart data={data} {...common}>{grid}{xa}<YAxis {...axis} /><Tooltip content={<Tip unit=" kW" digits={0} />} />
          <Area name="Power" dataKey="power" stroke={tokens.secondary} fill={tokens.secondary} fillOpacity={0.15} strokeWidth={1.8} dot={false} isAnimationActive={false} /></AreaChart>
      </ChartCard>
      <ChartCard title="Ambient temperature" desc="Nacelle ambient, °C">
        <LineChart data={data} {...common}>{grid}{xa}<YAxis {...axis} unit="°" /><Tooltip content={<Tip unit=" °C" />} />
          <Line name="Ambient" dataKey="ambient" stroke="#64748B" strokeWidth={1.8} dot={false} isAnimationActive={false} /></LineChart>
      </ChartCard>
      <ChartCard title="Anomaly score progression" desc="0 = normal, 1 = highly anomalous">
        <AreaChart data={data} {...common}>{grid}{xa}<YAxis {...axis} domain={[0, 1]} /><Tooltip content={<Tip digits={2} />} />
          <ReferenceLine y={0.5} stroke={tokens.warn} strokeDasharray="4 3" />
          <Area name="Anomaly" dataKey="anomaly" stroke={tokens.ai} fill={tokens.ai} fillOpacity={0.15} strokeWidth={2} dot={false} isAnimationActive={false} /></AreaChart>
      </ChartCard>
      <div className="lg:col-span-2">
        <ChartCard h={230} title="Failure risk progression" desc="Predicted failure probability with uncertainty band. Green < 35 % ≤ yellow < 75 % ≤ red" legend={[{ color: tokens.crit, label: "Risk" }, { color: "#FCA5A5", label: "Uncertainty band" }, { color: tokens.warn, label: "Yellow 35 %", dashed: true }, { color: tokens.crit, label: "Red 75 %", dashed: true }]}>
          <ComposedChart data={band} {...common}>{grid}{xa}<YAxis {...axis} domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} /><Tooltip content={<Tip digits={2} />} />
            <ReferenceLine y={0.35} stroke={tokens.warn} strokeDasharray="4 3" /><ReferenceLine y={0.75} stroke={tokens.crit} strokeDasharray="4 3" />
            <Area name="band" dataKey="rband" stroke="none" fill="#FCA5A5" fillOpacity={0.35} isAnimationActive={false} tooltipType="none" />
            <Line name="Risk" dataKey="risk" stroke={tokens.crit} strokeWidth={2.2} dot={false} isAnimationActive={false} /></ComposedChart>
        </ChartCard>
      </div>
    </div>
  );
});
