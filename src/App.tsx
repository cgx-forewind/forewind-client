import { ReplayFooter, ReplayReadings, useReplay } from "@/components/SignalReplay";
import { Suspense, lazy, useEffect } from "react";
import { useStore, roleHome } from "@/store/useStore";
import { go, parse, useHash } from "@/lib/router";
import { AppShell, AssistantDrawer, TechShell } from "@/components/layout/Shell";
import { DemoPanel } from "@/components/layout/DemoPanel";
import { Toasts, CardSkeleton } from "@/components/common/bits";
import { IncomingCallOverlay } from "@/components/common/call";

const SeniorDashboard = lazy(() => import("@/pages/senior/Dashboard"));
const Turbines = lazy(() => import("@/pages/senior/Turbines"));
const TurbineDetail = lazy(() => import("@/pages/senior/TurbineDetail"));
const Predictive = lazy(() => import("@/pages/senior/Predictive"));
const Optimization = lazy(() => import("@/pages/senior/Optimization"));
const Technicians = lazy(() => import("@/pages/senior/Technicians"));
const Reports = lazy(() => import("@/pages/senior/Reports"));
const Engine = lazy(() => import("@/pages/senior/Engine"));
const AssistantPage = lazy(() => import("@/pages/Assistant"));
const ExecDashboard = lazy(() => import("@/pages/exec/Dashboard"));
const Financial = lazy(() => import("@/pages/exec/Financial"));
const Assets = lazy(() => import("@/pages/exec/Assets"));
const TechHome = lazy(() => import("@/pages/tech/Home"));
const TechTask = lazy(() => import("@/pages/tech/Task"));

const Fallback = () => (
  <div className="page"><div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div></div>
);

const ReplayWorkspace = lazy(() => import("@/pages/ReplayWorkspace"));

function Routes() {
  const hash = useHash();
  const r = parse(hash);
  const simulation = useReplay(s => s.simulation);
  if (!simulation && r.page !== "care-replay") return <ReplayWorkspace route={r} />;
  if (r.area === "senior") {
    switch (r.page) {
      case "turbines": return r.param ? <TurbineDetail id={r.param} /> : <Turbines />;
      case "care-replay": return <iframe title="CARE event 40 report" src="./care/event40.html" className="block w-full border-0" style={{ height: "calc(100dvh - var(--replay-height, 0px) - 4rem)" }} />;
      case "predictive": return <Predictive />;
      case "optimization": return <Optimization />;
      case "technicians": return <Technicians />;
      case "reports": return <Reports />;
      case "engine": return <Engine />;
      case "assistant": return <AssistantPage role="senior" />;
      default: return <SeniorDashboard />;
    }
  }
  if (r.area === "exec") {
    switch (r.page) {
      case "financial": return <Financial />;
      case "assets": return <Assets />;
      case "assistant": return <AssistantPage role="executive" />;
      default: return <ExecDashboard />;
    }
  }
  switch (r.page) {
    case "task": return <TechTask />;
    case "assistant": return <AssistantPage role="technician" />;
    default: return <TechHome />;
  }
}

export default function App() {
  const hash = useHash();
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const area = parse(hash).area;

  // keep role and route in sync (deep links set the role; role switcher sets the route)
  useEffect(() => {
    if (!window.location.hash) go(roleHome.senior);
    const want = area === "exec" ? "executive" : area === "tech" ? "technician" : "senior";
    if (want !== role) setRole(want);
  }, [area]); // eslint-disable-line react-hooks/exhaustive-deps

  const simulation = useReplay(s => s.simulation);
  const Shell = area === "tech" ? TechShell : AppShell;
  return (
    <>
      <Shell>
        {!simulation && <ReplayReadings />}
        <Suspense fallback={<Fallback />}><Routes /></Suspense>
      </Shell>
      <ReplayFooter />
      {simulation && <><DemoPanel />
      <AssistantDrawer />
      <Toasts /></>}
      {simulation && area === "tech" && <IncomingCallOverlay />}
    </>
  );
}
