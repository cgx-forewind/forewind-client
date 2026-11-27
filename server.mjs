// Minimal static server for Databricks Apps (and any Node host).
// Serves ./dist with SPA fallback. Predictions, optimisation, safety decisions and agent
// orchestration are NOT implemented here — the frontend talks to the unified engine through
// src/services/api.ts. Replace the mock handlers there with calls to /api/engine/* (proxy below).
import { getWind } from "./wind.mjs";
import { readSignals } from "./warehouse.mjs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const port = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/warehouse/signals") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") {
      res.writeHead(405, { Allow: "GET" });
      return res.end();
    }
    try {
      const { status, body } = await readSignals();
      res.writeHead(status);
      return res.end(JSON.stringify(body));
    } catch {
      res.writeHead(502);
      return res.end(JSON.stringify({ error: "Warehouse query failed. Check access, column mapping and warehouse availability." }));
    }
  }
  if (url.pathname === "/api/weather/thornton-bank") {
    res.setHeader("Content-Type", "application/json");
    if (req.method !== "GET") {
      res.writeHead(405, { Allow: "GET" });
      return res.end();
    }
    try {
      return res.end(JSON.stringify(await getWind()));
    } catch {
      res.writeHead(503);
      return res.end(JSON.stringify({ error: "Thornton Bank forecast unavailable" }));
    }
  }
  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", app: "team-cgx-predictive-maintenance" }));
  }
  // Placeholder for the real engine gateway (e.g. Databricks Model Serving / Jobs endpoints).
  if (url.pathname.startsWith("/api/engine/")) {
    res.writeHead(501, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "Engine gateway not configured. Frontend is using mock services." }));
  }
  let file = normalize(join(root, url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    if (!(await stat(file)).isFile()) throw new Error("nf");
  } catch {
    file = join(root, "index.html");
  }
  try {
    const body = await readFile(file);
    const cache = file.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": cache });
    res.end(body);
  } catch {
    res.writeHead(500); res.end("Server error");
  }
}).listen(port, () => console.log(`Team CGX app listening on :${port}`));
