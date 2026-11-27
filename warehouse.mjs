// The operator selects one dataset and the columns that may be displayed to app viewers.
export async function readSignals(env = process.env, request = fetch) {
  const appIdentity = env.DATABRICKS_CLIENT_ID && env.DATABRICKS_CLIENT_SECRET;
  const source = env.FOREWIND_SIGNAL_TABLE?.split(".");
  const columns = ["TIME", "TURBINE", "SIGNAL", "VALUE"].map(key => env["FOREWIND_COLUMN_" + key]);
  if (source?.length !== 3 || ![...source, ...columns].every(id => typeof id === "string" && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)) ||
      !env.DATABRICKS_SQL_WAREHOUSE_ID || !(appIdentity || env.DATABRICKS_TOKEN)) {
    return { status: 503, body: { error: "Warehouse signal source is not configured." } };
  }
  let token = env.DATABRICKS_TOKEN;
  if (appIdentity) {
    const basic = Buffer.from(env.DATABRICKS_CLIENT_ID + ":" + env.DATABRICKS_CLIENT_SECRET).toString("base64");
    const oauth = await request("https://diggibyte.databricks.com/oidc/v1/token", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { Authorization: "Basic " + basic },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "all-apis" }),
    });
    if (!oauth.ok) throw new Error("Warehouse app authorization failed");
    token = (await oauth.json()).access_token;
    if (!token) throw new Error("Warehouse app authorization failed");
  }
  const quote = id => "`" + id + "`";
  const time = quote(columns[0]);
  const statement = `SELECT ${columns.map(quote).join(", ")} FROM ${source.map(quote).join(".")} ORDER BY ${time} DESC LIMIT 20`;
  const response = await request("https://diggibyte.databricks.com/api/2.0/sql/statements/", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(35000),
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ warehouse_id: env.DATABRICKS_SQL_WAREHOUSE_ID, statement, wait_timeout: "30s", on_wait_timeout: "CANCEL" })
  });
  if (!response.ok) throw new Error("Warehouse request failed");
  const result = await response.json();
  if (result.status?.state !== "SUCCEEDED") throw new Error("Query did not complete");
  const rows = result.result?.data_array ?? (result.manifest?.total_row_count === 0 ? [] : undefined);
  if (!Array.isArray(rows) || !rows.every(row => Array.isArray(row) && row.length === 4)) throw new Error("Unexpected result");
  return { status: 200, body: { rows } };
}
