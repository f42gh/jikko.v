#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params_from_iter, types::ValueRef, Connection};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, State};

struct DbPath {
    path: PathBuf,
}

#[tauri::command]
fn execute_sql(state: State<DbPath>, sql: String, params: Vec<Value>) -> Result<(), String> {
    let conn = open_connection(&state.path)?;
    let converted = convert_params(&params);
    conn.execute(&sql, params_from_iter(converted.iter()))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn select_sql(
    state: State<DbPath>,
    sql: String,
    params: Vec<Value>,
) -> Result<Vec<std::collections::HashMap<String, Value>>, String> {
    let conn = open_connection(&state.path)?;
    let converted = convert_params(&params);
    let mut stmt = conn.prepare(&sql).map_err(|error| error.to_string())?;
    let column_names: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect();

    let rows = stmt
        .query_map(params_from_iter(converted.iter()), |row| {
            let mut map = std::collections::HashMap::new();
            for (index, name) in column_names.iter().enumerate() {
                let value = match row.get_ref(index)? {
                    ValueRef::Null => Value::Null,
                    ValueRef::Integer(v) => Value::from(v),
                    ValueRef::Real(v) => Value::from(v),
                    ValueRef::Text(v) => Value::from(String::from_utf8_lossy(v).to_string()),
                    ValueRef::Blob(_) => Value::from("<blob>"),
                };
                map.insert(name.clone(), value);
            }
            Ok(map)
        })
        .map_err(|error| error.to_string())?;

    let collected: Result<Vec<_>, _> = rows.collect();
    collected.map_err(|error| error.to_string())
}

fn convert_params(params: &[Value]) -> Vec<rusqlite::types::Value> {
    params
        .iter()
        .map(|value| match value {
            Value::Null => rusqlite::types::Value::Null,
            Value::Bool(v) => rusqlite::types::Value::Integer(i64::from(*v)),
            Value::Number(v) => {
                if let Some(integer) = v.as_i64() {
                    rusqlite::types::Value::Integer(integer)
                } else if let Some(float) = v.as_f64() {
                    rusqlite::types::Value::Real(float)
                } else {
                    rusqlite::types::Value::Null
                }
            }
            Value::String(v) => rusqlite::types::Value::Text(v.clone()),
            Value::Array(_) | Value::Object(_) => rusqlite::types::Value::Text(value.to_string()),
        })
        .collect()
}

fn open_connection(path: &PathBuf) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let conn = Connection::open(path).map_err(|error| error.to_string())?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL,
          parent_task_id TEXT,
          effort_estimate INTEGER NOT NULL DEFAULT 3,
          urgency INTEGER NOT NULL DEFAULT 3,
          impact INTEGER NOT NULL DEFAULT 3,
          penalty_of_delay INTEGER NOT NULL DEFAULT 3,
          momentum_gain INTEGER NOT NULL DEFAULT 3,
          emotional_resistance INTEGER NOT NULL DEFAULT 2,
          energy_required INTEGER NOT NULL DEFAULT 3,
          due_at TEXT,
          observe_memo TEXT NOT NULL DEFAULT '',
          orient_memo TEXT NOT NULL DEFAULT '',
          pain_score INTEGER,
          gain_score INTEGER,
          deadline_at TEXT,
          estimated_minutes INTEGER,
          act_started_at TEXT,
          act_due_at TEXT,
          progress_note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS task_score_snapshots (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          priority_score REAL NOT NULL,
          expected_roi REAL NOT NULL,
          score_breakdown_json TEXT NOT NULL,
          why_now_summary TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS task_events (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS daily_recommendations (
          id TEXT PRIMARY KEY NOT NULL,
          date TEXT NOT NULL,
          recommended_task_id TEXT NOT NULL,
          rationale_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reward_records (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          reward_type TEXT NOT NULL,
          reward_value REAL NOT NULL,
          note TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reflections (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          actual_benefit TEXT NOT NULL,
          perceived_difficulty INTEGER NOT NULL,
          confidence_gain REAL NOT NULL,
          memo TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        ",
    )
    .map_err(|error| error.to_string())?;
    ensure_column(
        &conn,
        "ALTER TABLE tasks ADD COLUMN observe_memo TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        &conn,
        "ALTER TABLE tasks ADD COLUMN orient_memo TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(&conn, "ALTER TABLE tasks ADD COLUMN pain_score INTEGER")?;
    ensure_column(&conn, "ALTER TABLE tasks ADD COLUMN gain_score INTEGER")?;
    ensure_column(&conn, "ALTER TABLE tasks ADD COLUMN deadline_at TEXT")?;
    ensure_column(&conn, "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER")?;
    ensure_column(&conn, "ALTER TABLE tasks ADD COLUMN act_started_at TEXT")?;
    ensure_column(&conn, "ALTER TABLE tasks ADD COLUMN act_due_at TEXT")?;
    ensure_column(
        &conn,
        "ALTER TABLE tasks ADD COLUMN progress_note TEXT NOT NULL DEFAULT ''",
    )?;
    Ok(conn)
}

fn ensure_column(conn: &Connection, sql: &str) -> Result<(), String> {
    match conn.execute(sql, []) {
        Ok(_) => Ok(()),
        Err(error) => {
            let message = error.to_string();
            if message.contains("duplicate column name") {
                Ok(())
            } else {
                Err(message)
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error.to_string()))?;
            let db_path = data_dir.join("local-data.sqlite");
            app.manage(DbPath { path: db_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![execute_sql, select_sql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
