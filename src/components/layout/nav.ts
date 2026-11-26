import { Activity, BrainCircuit, CalendarClock, FileText, Gauge, LayoutDashboard, Landmark, Layers, Sparkles, Users, Wind, Home, ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; badge?: "alerts" | "approval" }

export const NAV: Record<"senior" | "exec" | "tech", NavItem[]> = {
  senior: [
    { to: "#/senior/dashboard", label: "Operations Centre", icon: LayoutDashboard },
    { to: "#/senior/turbines", label: "Turbines", icon: Wind },
    { to: "#/senior/predictive", label: "Predictive Maintenance", icon: Activity },
    { to: "#/senior/optimization", label: "Maintenance Optimisation", icon: CalendarClock, badge: "approval" },
    { to: "#/senior/technicians", label: "Technicians", icon: Users },
    { to: "#/senior/reports", label: "Reports", icon: FileText },
    { to: "#/senior/engine", label: "Engine Activity", icon: BrainCircuit, badge: "alerts" },
    { to: "#/senior/assistant", label: "AI Assistant", icon: Sparkles },
  ],
  exec: [
    { to: "#/exec/dashboard", label: "Executive Dashboard", icon: Gauge },
    { to: "#/exec/financial", label: "Financial Intelligence", icon: Landmark },
    { to: "#/exec/assets", label: "Asset Overview", icon: Layers },
    { to: "#/exec/assistant", label: "Executive AI Assistant", icon: Sparkles },
  ],
  tech: [
    { to: "#/tech/home", label: "Home", icon: Home },
    { to: "#/tech/task", label: "Task", icon: ClipboardList },
    { to: "#/tech/assistant", label: "Assistant", icon: Sparkles },
  ],
};

export const AREA_TITLE = { senior: "Maintenance Operations Centre", exec: "Executive Intelligence Centre", tech: "Field Operations" } as const;
