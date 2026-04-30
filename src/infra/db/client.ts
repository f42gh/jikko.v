import { drizzle } from "drizzle-orm/sqlite-proxy";
import { invoke } from "@tauri-apps/api/core";

type SqlRow = Record<string, unknown>;

export const db = drizzle(async (sql, params, method) => {
  if (!isTauri()) {
    return { rows: [] };
  }

  if (method === "all") {
    const rows = await invoke<SqlRow[]>("select_sql", {
      sql,
      params: normalizeParams(params),
    });
    return { rows };
  }

  await invoke("execute_sql", {
    sql,
    params: normalizeParams(params),
  });
  return { rows: [] };
});

function normalizeParams(params: unknown[]) {
  return params.map((value) => (typeof value === "bigint" ? Number(value) : value));
}

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
