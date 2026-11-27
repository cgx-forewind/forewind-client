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

### Diggibyte warehouse readings

In Predictive maintenance, **Load latest 20** reads the configured signal source through the Node server. The fleet model still uses simulation. Run the production build with `npm run build && npm start` (Node 20+). Static hosting alone cannot serve the warehouse endpoint.

Set server environment variables `DATABRICKS_SQL_WAREHOUSE_ID`, `DATABRICKS_TOKEN` (from the host's secret manager), and `FOREWIND_SIGNAL_TABLE` (catalog.schema.table or view). Map four existing columns through `FOREWIND_COLUMN_TIME`, `FOREWIND_COLUMN_TURBINE`, `FOREWIND_COLUMN_SIGNAL`, and `FOREWIND_COLUMN_VALUE`. Use a timestamp column for ordering. For wide-format measurements a team view can present one signal per row. All viewers who can reach this server endpoint can see the selected readings: configure only a dataset approved for that audience. The server uses the [Statement Execution API](https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial) at diggibyte.databricks.com. The warehouse identity needs read access to the source and permission to use the warehouse.
