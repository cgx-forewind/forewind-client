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

Databricks Apps supplies the service principal via `DATABRICKS_CLIENT_ID` and `DATABRICKS_CLIENT_SECRET`. Set server environment variables `DATABRICKS_SQL_WAREHOUSE_ID` and `FOREWIND_SIGNAL_TABLE` (catalog.schema.table or view). Map four existing columns through `FOREWIND_COLUMN_TIME`, `FOREWIND_COLUMN_TURBINE`, `FOREWIND_COLUMN_SIGNAL`, and `FOREWIND_COLUMN_VALUE`. Use a timestamp column for ordering. For wide-format measurements a team view can present one signal per row. All viewers who can reach this server endpoint can see the selected readings: configure only a dataset approved for that audience. The server uses the [Statement Execution API](https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial) at diggibyte.databricks.com. The warehouse identity needs read access to the source and permission to use the warehouse.

### Historical training and forecast weather

Open **Predictive maintenance → Historical wind-to-power training** and choose CARE, Kelmarsh, Penmanshiel or La Haute Borne. Each selection fits a fresh power baseline to the chosen turbine. The bundled windows, import command and dataset credits are documented in [training sources](public/training/SOURCES.md).

**Maintenance optimisation → Thornton Bank** fetches current 10 m forecast winds from MET Norway through the Node server. Start the production build with `npm run build && npm start`. The server needs outbound HTTPS to api.met.no. Historical samples also work when the weather provider is unavailable.

### Explain a CARE alert in the browser

Use the current reading to create a request. Forewind's Node server uses MiraConnect to reach the hub.

```js
import { createAlertExplanation } from "/explain-alert.js";

const explain = createAlertExplanation({
  dataset: "CARE to Compare v6", turbine_id: 10, event_id: 40,
  timestamp: "2022-12-25T11:50:00", alert: "Generator bearing heat above ambient",
  heat_above_ambient_c: 59, threshold_c: 56,
});
const job = await explain();
if (job.status === "done") console.log(job.text);
```

After a timeout or connection error, call the same `explain()` again to resume. A confirmed `failed` job can be rerun by creating a new request.

For the contest install, run `npm run seed:hub` as the Forewind service user.
It seeds the two codegeex.dev URLs in `$XDG_CONFIG_HOME/forewind/hub.env`
(default `~/.config/forewind/hub.env`) and preserves an existing file.
Load that file into the Node service environment and supply `MIRA_TOKEN` from
the service's secret configuration. The browser needs no configuration.

### Explain the simulated maintenance plan

In **Simulated fleet → Maintenance optimisation**, raise a yellow alert, then click
**Why this maintenance window?**. The app sends the nine candidate slots to the
hub using action `maintenance_window`. A sink advertising this action can call
`scripts/maintenance_window.py::explain_window(args)` and return its result.
The rule compares eligible slots by lost revenue, then by safety margin.
The explanation includes the chosen UTC interval and compares alternatives.
If every slot fails a check, it reports that there is no eligible window.
