import * as React from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Inbox, RefreshCw, Sparkles, WifiOff, X, Info, TrendingUp, TrendingDown } from "lucide-react";
import type { Risk, Toast } from "@/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { riskLabel, SIM_NOTE } from "@/lib/tokens";
import { useStore } from "@/store/useStore";

export function RiskBadge({ risk, className }: { risk: Risk; className?: string }) {
  const map = { green: ["ok", CheckCircle2], yellow: ["warn", AlertTriangle], red: ["crit", CircleAlert] } as const;
  const [v, Icon] = map[risk];
  return (
    <Badge variant={v} className={className}>
      <Icon className="h-3 w-3" aria-hidden />
      {riskLabel[risk]}
    </Badge>
  );
}

export const riskDot = (r: Risk) => (r === "green" ? "bg-ok" : r === "yellow" ? "bg-warn" : "bg-crit");

export function SimTag({ className, label = "Simulated" }: { className?: string; label?: string }) {
  return (
    <span title={SIM_NOTE} className={cn("inline-flex items-center rounded-md border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted", className)}>
      {label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({ label, value, hint, icon, tone = "default", trend, sim, onClick }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "crit" | "ai" | "primary"; trend?: "up" | "down"; sim?: boolean; onClick?: () => void;
}) {
  const tones = { default: "bg-slate-100 text-slate-600", ok: "bg-ok-soft text-ok-ink", warn: "bg-warn-soft text-warn-ink", crit: "bg-crit-soft text-crit-ink", ai: "bg-ai-soft text-ai-ink", primary: "bg-primary-50 text-primary" };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cn("rounded-xl border border-line bg-white p-4 text-left shadow-card transition", onClick && "hover:-translate-y-0.5 hover:shadow-pop focus-visible:ring-2 focus-visible:ring-accent")}>
      <div className="flex items-start justify-between gap-2">
        <span className="kpi-label">{label}</span>
        {icon && <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tones[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {trend && (trend === "up" ? <TrendingUp className="h-4 w-4 text-ok" aria-label="increasing" /> : <TrendingDown className="h-4 w-4 text-ok" aria-label="decreasing" />)}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        {hint}
        {sim && <SimTag />}
      </div>
    </Comp>
  );
}

export function AiExplain({ title = "AI explanation", children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-ai/20 bg-ai-soft/50 p-4", className)}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ai-ink">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> {title}
      </div>
      <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400"><Inbox className="h-5 w-5" /></div>
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="max-w-sm text-xs text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const offline = useStore((s) => s.offline);
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <div className={cn("grid h-11 w-11 place-items-center rounded-full", offline ? "bg-warn-soft text-warn-ink" : "bg-crit-soft text-crit-ink")}>
        {offline ? <WifiOff className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
      </div>
      <p className="text-sm font-semibold">{offline ? "You're offline" : "Something went wrong"}</p>
      <p className="max-w-sm text-xs text-muted">{error.message}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>}
    </div>
  );
}

export function CardSkeleton({ h = 220, className }: { h?: number; className?: string }) {
  return (
    <Card className={className} aria-busy="true" aria-label="Loading">
      <CardContent className="space-y-3 pt-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="w-full" />
        <Skeleton className="w-full" />
        <div style={{ height: h }}><Skeleton className="h-full w-full" /></div>
      </CardContent>
    </Card>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  const icons: Record<Toast["tone"], React.ReactNode> = {
    info: <Info className="h-4 w-4 text-accent" />, success: <CheckCircle2 className="h-4 w-4 text-ok" />,
    warning: <AlertTriangle className="h-4 w-4 text-warn" />, critical: <CircleAlert className="h-4 w-4 text-crit" />,
  };
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-[calc(var(--replay-height,0px)+5rem)] right-3 z-[70] flex w-[min(92vw,22rem)] flex-col gap-2 sm:bottom-[calc(var(--replay-height,0px)+1rem)] sm:right-4">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="pointer-events-auto flex gap-3 rounded-xl border border-line bg-white p-3 shadow-pop animate-slideUp">
          <span className="mt-0.5">{icons[t.tone]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-muted">{t.body}</p>}
          </div>
          <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="h-6 w-6 rounded-md text-muted hover:bg-slate-100"><X className="mx-auto h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: i.dashed ? `repeating-linear-gradient(90deg,${i.color} 0 4px,transparent 4px 7px)` : i.color, height: 3 }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
