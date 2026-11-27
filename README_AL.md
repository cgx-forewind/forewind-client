# Mira Notes

Forewind is Team CGX's prototype for wind-turbine maintenance planning. It presents a shared demo to three roles: maintenance lead, executive and technician. The screens cover fleet and turbine status, predicted issues, maintenance windows, technician dispatch, tasks, reports and an assistant.

**This is a simulation, not an operational maintenance system.** The data, predictions, calls and financial figures are simulated; they are not verified SKF results. The role switcher is a demo control, not authentication. The app must not be used to make safety or dispatch decisions.

## How the pieces fit

- React and TypeScript render the interface, styled with Tailwind; Vite builds it.
- `src/store/useStore.ts` holds shared client-side demo state across roles.
- `src/services/api.ts` provides asynchronous mock services. They call the local simulation in `src/engine/`, including telemetry, maintenance windows, dispatch, assistant responses and finance. The offline switch simulates an unavailable service.
- `src/pages/` contains role-specific views; `src/components/` provides shared controls, layouts, maps and charts.
- `server.mjs` serves the built `dist/` files and a `/healthz` endpoint. Its `/api/engine/` route returns 501: a real backend is not connected.

The yellow and red demo flows illustrate planning and emergency dispatch. A proposed maintenance window still requires human clearance, and the technician checklist gates starting work in the demo. These controls are illustrative, not validated real-world safety procedures.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To check a production build, run `npm run build` followed by `npm start`; the server uses `DATABRICKS_APP_PORT`, then `PORT`, or defaults to 8000. The development server and production server are different processes; stop either with Ctrl+C.

## Databricks and next steps

The repository includes `app.yaml` and a Node static server as a starting point for Databricks Apps. Deployment, app permissions, Git connectivity and real data access still need verification in the target workspace. In particular, check that build-time dependencies are installed when `NODE_ENV=production` is set in `app.yaml`.

For a first real integration, agree on a data contract with the team and connect one reviewable case, such as CARE Farm A, turbine 10, event 40. Keep the dataset clock and active event-window filter explicit when comparing alert timestamps. Replace mock services deliberately, preserve clear simulation labels where needed, and validate results against the agreed replay before claiming live predictions or benefits.
