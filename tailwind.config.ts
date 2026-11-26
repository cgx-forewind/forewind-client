import type { Config } from "tailwindcss";

// Centralised design tokens (mirrors src/lib/tokens.ts).
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0057B8", foreground: "#FFFFFF", 50: "#EEF5FF", 100: "#DCEAFF" },
        navy: "#0F172A",
        accent: { DEFAULT: "#3B82F6" },
        surface: "#F5F7FA",
        ok: { DEFAULT: "#16A34A", soft: "#DCFCE7", ink: "#166534" },
        warn: { DEFAULT: "#F59E0B", soft: "#FEF3C7", ink: "#92400E" },
        crit: { DEFAULT: "#DC2626", soft: "#FEE2E2", ink: "#991B1B" },
        ai: { DEFAULT: "#7C3AED", soft: "#EDE9FE", ink: "#5B21B6" },
        muted: { DEFAULT: "#64748B", foreground: "#64748B" },
        line: "#E2E8F0",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        pop: "0 10px 30px -8px rgba(15,23,42,0.18)",
      },
      borderRadius: { xl: "0.875rem" },
      keyframes: {
        pulseRing: { "0%": { transform: "scale(1)", opacity: "0.6" }, "100%": { transform: "scale(2.4)", opacity: "0" } },
        slideUp: { from: { transform: "translateY(8px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        wave: { "0%,100%": { transform: "scaleY(0.3)" }, "50%": { transform: "scaleY(1)" } },
      },
      animation: {
        pulseRing: "pulseRing 1.6s ease-out infinite",
        slideUp: "slideUp .25s ease-out",
        fadeIn: "fadeIn .2s ease-out",
        wave: "wave 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
