import { useStore } from "@/store/useStore";
import { KpiCard, PageHeader, SimTag, RiskBadge, EmptyState } from "@/components/common/bits";
import { WindFarmMap } from "@/components/common/maps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eur, pct } from "@/lib/utils";
import { REACTIVE_FAILURE_COST } from "@/engine/finance";
import { CheckCircle2, Hammer, TriangleAlert } from "lucide-react";

export default function Assets() {
  const fleet = useStore((s) => s.fleet);
  const jobs = useStore((s) => s.jobs);
  const op = fleet.filter((t) => t.status === "operational");
  const maint = fleet.filter((t) => t.status === "maintenance");
  const risk = fleet.filter((t) => t.risk !== "green" && t.status !== "maintenance");
  const rows = [...risk, ...maint.filter((m) => !risk.includes(m))].map((t) => {
    const job = jobs.find((j) => j.turbineId === t.id && j.status === "open");
    const planned = t.maint !== "emergency" && t.risk !== "red";
    return {
      t, downtime: t.status === "maintenance" ? "In service now (≈ 8 h)" : planned ? "≈ 8 h planned" : "≈ 12 h emergency (vs ≈ 9 days if it fails)",
      impact: job ? `${eur(job.lostRevenue)} lost production; avoids ≈ ${eur(job.reactiveCostAvoided, true)}` : t.risk === "red" ? `Exposure ≈ ${eur(REACTIVE_FAILURE_COST, true)} if unplanned` : t.status === "maintenance" ? "Routine service — low impact" : `Exposure ≈ ${eur(REACTIVE_FAILURE_COST, true)} if unplanned`,
    };
  });
  return (
    <div className="page">
      <PageHeader title="Asset overview" subtitle={<>Simplified fleet view <SimTag className="ml-1" /></>} />
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Operational" value={op.length} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} hint={pct(op.length / fleet.length, 1) + " of fleet"} />
        <KpiCard label="In maintenance" value={maint.length} tone="primary" icon={<Hammer className="h-4 w-4" />} hint="Planned downtime" />
        <KpiCard label="At risk" value={risk.length} tone={risk.length ? "warn" : "ok"} icon={<TriangleAlert className="h-4 w-4" />} hint="Response coordinated" />
      </div>
      <Card><CardHeader><div><CardTitle>Fleet map</CardTitle><CardDescription>Colour = condition</CardDescription></div></CardHeader><CardContent><WindFarmMap fleet={fleet} height={300} /></CardContent></Card>
      <Card>
        <CardHeader><div><CardTitle>Expected downtime &amp; business impact</CardTitle><CardDescription>Turbines needing attention</CardDescription></div></CardHeader>
        {rows.length === 0 ? <EmptyState title="Nothing needs attention" body="All turbines are running normally." /> : (
          <div className="overflow-x-auto"><table className="tbl w-full min-w-[640px]"><thead><tr><th>Turbine</th><th>Condition</th><th>Status</th><th>Expected downtime</th><th>Business impact</th></tr></thead>
            <tbody>{rows.map(({ t, downtime, impact }) => <tr key={t.id}><td className="font-semibold">{t.id}</td><td><RiskBadge risk={t.risk} /></td><td><Badge variant={t.status === "maintenance" ? "primary" : "default"}>{t.status === "maintenance" ? "In maintenance" : t.maint === "none" ? "Operating" : t.maint.replace("_", " ")}</Badge></td><td className="text-sm">{downtime}</td><td className="text-sm text-muted">{impact}</td></tr>)}</tbody></table></div>
        )}
      </Card>
    </div>
  );
}
