# Team CGX — Intelligent Predictive Maintenance Platform

React + TypeScript + Tailwind + shadcn-style UI + Lucide + Recharts. One unified intelligence engine, three role experiences (Senior, C-Level, Technician).

**All data is simulated.** Predictions, calls and financial figures are labelled and are not verified SKF data. The role switcher is a demo tool, not authentication.

## Run

```bash
npm install
npm run dev        # development
npm run build      # typecheck + production build into dist/
npm start          # serves dist/ (Databricks Apps entry, honours DATABRICKS_APP_PORT / PORT)
```

## Demo (bottom-left "Demo mode")
- **Auto: yellow** — degradation → yellow alert → windows → approval → dispatch → completion → executive financials.
- **Auto: red** — red alert → emergency call (first candidate declines, second accepts) → completion.
- Manual steps cover every control in the brief. "No reply" escalates to the senior and stops automated dispatch.
- "Simulate offline" demonstrates offline/error states. Realised vs projected finance updates on completion.

## Architecture
- `src/engine/*` — mock **unified engine** (telemetry, RUL, windows, safety checks, technician ranking, assistant, finance). No business logic lives in components.
- `src/services/api.ts` — the only seam to replace: each function maps to an engine endpoint (`/api/engine/...`, Databricks Model Serving / Jobs / Agent).
- `src/store/useStore.ts` — shared zustand state; all three roles read one snapshot.
- Safety rules: windows are never "safe" — only "constraints met · clearance pending"; emergency overrides optimisation; start-work is locked until the technician confirms the checklist.

## Databricks Apps
`app.yaml` + `server.mjs` (static server, `/healthz`). No external infrastructure; the map is a local SVG. Inter is loaded from Google Fonts — self-host it if the workspace blocks external fonts (falls back to system UI fonts).
