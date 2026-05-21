#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params_from_iter, types::ValueRef, Connection};
use serde_json::Value;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{Manager, State};

struct DbPath {
    path: PathBuf,
}

#[tauri::command]
fn execute_sql(state: State<DbPath>, sql: String, params: Vec<Value>) -> Result<(), String> {
    let conn = Connection::open(&state.path).map_err(|error| error.to_string())?;
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
    let conn = Connection::open(&state.path).map_err(|error| error.to_string())?;
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

#[tauri::command]
fn run_analysis_helper(app: tauri::AppHandle, payload: Value) -> Result<Value, String> {
    let script_path = resolve_analysis_script(&app)?;
    let payload_json = payload.to_string();

    let output = run_python_script(&script_path, &payload_json)?;
    serde_json::from_slice::<Value>(&output.stdout).map_err(|error| error.to_string())
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
    initialize_schema(&conn)?;
    Ok(conn)
}

fn initialize_schema(conn: &Connection) -> Result<(), String> {
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

    let existing_columns = task_columns(conn)?;
    ensure_column(
        conn,
        &existing_columns,
        "observe_memo",
        "ALTER TABLE tasks ADD COLUMN observe_memo TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "orient_memo",
        "ALTER TABLE tasks ADD COLUMN orient_memo TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "pain_score",
        "ALTER TABLE tasks ADD COLUMN pain_score INTEGER",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "gain_score",
        "ALTER TABLE tasks ADD COLUMN gain_score INTEGER",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "deadline_at",
        "ALTER TABLE tasks ADD COLUMN deadline_at TEXT",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "estimated_minutes",
        "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "act_started_at",
        "ALTER TABLE tasks ADD COLUMN act_started_at TEXT",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "act_due_at",
        "ALTER TABLE tasks ADD COLUMN act_due_at TEXT",
    )?;
    ensure_column(
        conn,
        &existing_columns,
        "progress_note",
        "ALTER TABLE tasks ADD COLUMN progress_note TEXT NOT NULL DEFAULT ''",
    )?;
    Ok(())
}

fn resolve_analysis_script(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("analysis_helper.py");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;
    let bundled_path = resource_dir.join("analysis_helper.py");
    if bundled_path.exists() {
        return Ok(bundled_path);
    }

    Err("analysis helper script not found".to_string())
}

fn run_python_script(script_path: &PathBuf, payload_json: &str) -> Result<std::process::Output, String> {
    let python_candidates = ["python3", "python"];

    let mut last_error = "python executable not found".to_string();
    for candidate in python_candidates {
        match spawn_python(candidate, script_path, payload_json) {
            Ok(output) => {
                if output.status.success() {
                    return Ok(output);
                }

                return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
            }
            Err(error) => {
                last_error = error;
            }
        }
    }

    Err(last_error)
}

fn spawn_python(
    executable: &str,
    script_path: &PathBuf,
    payload_json: &str,
) -> Result<std::process::Output, String> {
    let mut child = Command::new(executable)
        .arg(script_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(payload_json.as_bytes())
            .map_err(|error| error.to_string())?;
    }

    child.wait_with_output().map_err(|error| error.to_string())
}

fn task_columns(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(tasks)")
        .map_err(|error| error.to_string())?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;
    let collected: Result<Vec<_>, _> = columns.collect();
    collected.map_err(|error| error.to_string())
}

fn ensure_column(
    conn: &Connection,
    existing_columns: &[String],
    column_name: &str,
    sql: &str,
) -> Result<(), String> {
    if existing_columns.iter().any(|name| name == column_name) {
        return Ok(());
    }

    conn.execute(sql, []).map_err(|error| error.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error.to_string()))?;
            let db_path = data_dir.join("local-data.sqlite");
            open_connection(&db_path)
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            app.manage(DbPath { path: db_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![execute_sql, select_sql, run_analysis_helper])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
