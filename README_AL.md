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

### Workspace exploration: shared weather samples

In Catalog Explorer, **Shares received → samples → accuweather** lists 12 daily, day/night and hourly forecast and historical tables in metric and imperial variants. These are sample tables, not confirmed Forewind sources. Databricks describes the collection as one month of data for the top 50 global cities, intended for exploration rather than production.

The overview of `samples.accuweather.forecast_hourly_metric` shows a managed Delta table. Its paginated schema includes the following **observed fields**, not an exhaustive schema:

| Fields | Type |
| --- | --- |
| `city_name`, `country_code` | string |
| `latitude`, `longitude`, `gmt_offset` | double |
| `datetime_valid_local` | timestamp |
| `wind_direction`, `wind_gust`, `wind_speed` | double |
| `weather_code`, `precipitation_probability`, `rain_probability` | int |
| `has_precipitation`, `has_rain` | boolean |
| `precipitation_lwe`, `rain_lwe` | double |
| `precipitation_type_desc` | string |

Related listed tables include `forecast_hourly_imperial`, `historical_hourly_metric`, `forecast_daily_calendar_metric`, and `forecast_daynight_metric` in the same schema. The overviews for `historical_hourly_metric` and `forecast_daily_calendar_metric` identify managed Delta tables owned by AccuWeather, but reported “No columns available” when inspected and refreshed; their schemas could not be verified. The other listed tables' structures were not inspected. Wind-field units and direction convention, actual time coverage, site proximity, permissions and sample values also remain unverified. Do not assume a forecast matches the wind farm or that these samples include turbine telemetry, spare parts or downtime events.

On the observed account, `team_skf.default` and `diggibyte_business_value_hackathon.default` showed zero visible tables. Databricks says this can mean the schema is empty **or** the account lacks access, so neither possibility has been established. The warehouse indicator was green during the later inspection; current runtime state, access, cost and data-export rules still require confirmation before connecting. Once the team confirms the right data sources, a backend on Mogwai could use an approved Databricks identity to query selected tables and expose only the necessary results to the app. Keep credentials on the server, not in the React bundle.

### Workspace exploration: Wanderbricks sample

The shared `samples.wanderbricks` schema lists 16 tables: `amenities`, `booking_updates`, `bookings`, `clickstream`, `countries`, `customer_support_logs`, `destinations`, `employees`, `hosts`, `page_views`, `payments`, `properties`, `property_amenities`, `property_images`, `reviews`, and `users`. Their descriptions concern a property-booking business, including guest bookings, hosts, payments and website activity; they are not identified as wind-park datasets.

`samples.wanderbricks.properties` is described as property data and shown as a managed Delta table, but its overview reported “No columns available” after refresh. The `employees` overview describes employees of property hosts, also as a managed Delta table; it likewise reported no available columns. Actual fields and access remain unverified. These employees must not be assumed to be turbine technicians or real dispatch data.
