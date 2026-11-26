// Centralised design tokens — keep in sync with tailwind.config.ts.
export const tokens = {
  primary: "#0057B8",
  navy: "#0F172A",
  secondary: "#3B82F6",
  background: "#F5F7FA",
  card: "#FFFFFF",
  ok: "#16A34A",
  warn: "#F59E0B",
  crit: "#DC2626",
  ai: "#7C3AED",
  muted: "#64748B",
  border: "#E2E8F0",
} as const;

export const riskColor = { green: tokens.ok, yellow: tokens.warn, red: tokens.crit } as const;
export const riskLabel = { green: "Healthy", yellow: "Degrading", red: "Critical" } as const;
export const SIM_NOTE = "Simulated data — not verified SKF data";
