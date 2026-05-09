use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{Map, Value};
use std::{
  fs,
  path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager, Runtime, WebviewWindowBuilder};
use tauri_plugin_log::{Target, TargetKind};

const DESKTOP_DATA_DIRECTORY: &str = "data";
const DESKTOP_SETTINGS_DIRECTORY: &str = "settings";
const DESKTOP_WEBVIEW_DIRECTORY: &str = "webview";
const DESKTOP_CACHE_DIRECTORY: &str = "cache";

fn sanitize_vault_path_segment(local_vault_id: &str) -> String {
  let sanitized: String = local_vault_id
    .trim()
    .chars()
    .map(|character| {
      if character.is_ascii_alphanumeric() || character == '_' || character == '-' {
        character
      } else {
        '_'
      }
    })
    .collect();

  if sanitized.is_empty() {
    "local-default".into()
  } else {
    sanitized
  }
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
fn sanitize_runtime_version_token(version: &str) -> String {
  let trimmed = version.trim();

  if trimmed.is_empty() {
    return "dev".into();
  }

  trimmed
    .chars()
    .map(|character| {
      if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
        character
      } else {
        '_'
      }
    })
    .collect()
}

#[cfg(target_os = "windows")]
fn build_runtime_version_token(identifier: &str, version: &str) -> String {
  let normalized_identifier = if identifier.trim().is_empty() {
    "com.locoris.desktop"
  } else {
    identifier.trim()
  };

  format!(
    "{}-{}",
    normalized_identifier,
    sanitize_runtime_version_token(version)
  )
  .chars()
  .map(|character| {
    if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
      character
    } else {
      '_'
    }
  })
  .collect()
}

fn fnv1a32(input: &str, seed: u32) -> u32 {
  let mut hash = seed;

  for byte in input.as_bytes() {
    hash ^= *byte as u32;
    hash = hash.wrapping_mul(0x0100_0193);
  }

  hash
}

fn u32_to_bytes(value: u32) -> [u8; 4] {
  [
    (value & 0xff) as u8,
    ((value >> 8) & 0xff) as u8,
    ((value >> 16) & 0xff) as u8,
    ((value >> 24) & 0xff) as u8,
  ]
}

fn build_macos_data_store_identifier(identifier: &str, version: &str) -> [u8; 16] {
  let seed_source = format!(
    "{}@{}",
    if identifier.trim().is_empty() {
      "com.locoris.desktop"
    } else {
      identifier.trim()
    },
    sanitize_runtime_version_token(version)
  );
  let seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  let mut bytes = [0u8; 16];

  for (index, seed) in seeds.iter().enumerate() {
    let hashed = fnv1a32(&format!("{index}:{seed_source}"), *seed);
    let chunk = u32_to_bytes(hashed);
    let start = index * 4;
    bytes[start..start + 4].copy_from_slice(&chunk);
  }

  bytes
}

fn native_vault_database_path<R: Runtime>(
  app: &AppHandle<R>,
  local_vault_id: &str,
) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("failed to resolve app data directory: {error}"))?;

  Ok(
    app_data_dir
      .join(DESKTOP_DATA_DIRECTORY)
      .join("vaults")
      .join(format!("{}.sqlite3", sanitize_vault_path_segment(local_vault_id))),
  )
}

fn ensure_parent_directory(path: &Path) -> Result<(), String> {
  let Some(parent_directory) = path.parent() else {
    return Ok(());
  };

  fs::create_dir_all(parent_directory)
    .map_err(|error| format!("failed to create native vault directory: {error}"))
}

fn ensure_native_vault_schema(connection: &Connection) -> Result<(), String> {
  connection
    .execute_batch(
      "
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL
      );
      ",
    )
    .map_err(|error| format!("failed to prepare native vault schema: {error}"))
}

fn read_metadata_value(connection: &Connection, key: &str) -> Result<Option<String>, String> {
  connection
    .query_row("SELECT value FROM metadata WHERE key = ?1", params![key], |row| row.get(0))
    .optional()
    .map_err(|error| format!("failed to read native vault metadata: {error}"))
}

fn read_collection_value(connection: &Connection, name: &str) -> Result<Option<String>, String> {
  connection
    .query_row(
      "SELECT payload FROM collections WHERE name = ?1",
      params![name],
      |row| row.get(0),
    )
    .optional()
    .map_err(|error| format!("failed to read native vault collection: {error}"))
}

fn parse_collection_value(
  connection: &Connection,
  name: &str,
  fallback: Value,
) -> Result<Value, String> {
  let Some(payload) = read_collection_value(connection, name)? else {
    return Ok(fallback);
  };

  serde_json::from_str(&payload)
    .map_err(|error| format!("failed to decode native vault collection `{name}`: {error}"))
}

fn write_metadata_value(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
  connection
    .execute(
      "INSERT INTO metadata (key, value) VALUES (?1, ?2)",
      params![key, value],
    )
    .map(|_| ())
    .map_err(|error| format!("failed to write native vault metadata: {error}"))
}

fn write_collection_value(connection: &Connection, name: &str, value: &Value) -> Result<(), String> {
  connection
    .execute(
      "INSERT INTO collections (name, payload) VALUES (?1, ?2)",
      params![name, value.to_string()],
    )
    .map(|_| ())
    .map_err(|error| format!("failed to write native vault collection `{name}`: {error}"))
}

fn ensure_runtime_layout<R: Runtime>(app: &mut tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
  let app_data_dir = app.path().app_data_dir()?;
  let app_cache_dir = app.path().app_cache_dir()?;
  let app_log_dir = app.path().app_log_dir()?;

  fs::create_dir_all(app_data_dir.join(DESKTOP_DATA_DIRECTORY))?;
  fs::create_dir_all(app_data_dir.join(DESKTOP_SETTINGS_DIRECTORY))?;
  fs::create_dir_all(app_data_dir.join(DESKTOP_WEBVIEW_DIRECTORY))?;
  fs::create_dir_all(app_cache_dir.join(DESKTOP_CACHE_DIRECTORY))?;
  fs::create_dir_all(app_log_dir)?;

  Ok(())
}

fn create_main_window<R: Runtime>(app: &mut tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
  let window_config = app
    .config()
    .app
    .windows
    .iter()
    .find(|config| config.label == "main")
    .cloned()
    .or_else(|| app.config().app.windows.first().cloned())
    .ok_or("missing main window configuration")?;

  let identifier = app.config().identifier.clone();
  let version = app.package_info().version.to_string();
  let app_handle = app.handle().clone();
  let mut builder = WebviewWindowBuilder::from_config(&app_handle, &window_config)?;

  #[cfg(target_os = "windows")]
  {
    let label = window_config.label.clone();
    let data_directory = app
      .path()
      .app_data_dir()?
      .join(build_windows_webview_directory(&label, &identifier, &version));
    fs::create_dir_all(&data_directory)?;
    builder = builder.data_directory(data_directory);
  }

  #[cfg(target_os = "macos")]
  {
    builder = builder.data_store_identifier(build_macos_data_store_identifier(&identifier, &version));
  }

  builder.build()?;
  Ok(())
}

#[cfg(target_os = "windows")]
fn build_windows_webview_directory(label: &str, identifier: &str, version: &str) -> String {
  format!(
    "{}/{}/{}",
    DESKTOP_WEBVIEW_DIRECTORY,
    if label.trim().is_empty() { "main" } else { label.trim() },
    build_runtime_version_token(identifier, version)
  )
}

#[tauri::command]
fn native_vault_store_read<R: Runtime>(
  app: AppHandle<R>,
  local_vault_id: String,
) -> Result<Option<String>, String> {
  let database_path = native_vault_database_path(&app, &local_vault_id)?;

  if !database_path.exists() {
    return Ok(None);
  }

  let connection = Connection::open(&database_path)
    .map_err(|error| format!("failed to open native vault database: {error}"))?;
  ensure_native_vault_schema(&connection)?;

  let Some(schema_version) = read_metadata_value(&connection, "schemaVersion")? else {
    return Ok(None);
  };

  let local_vault_id = read_metadata_value(&connection, "localVaultId")?
    .unwrap_or_else(|| local_vault_id.clone());
  let saved_at = read_metadata_value(&connection, "savedAt")?
    .and_then(|value| value.parse::<i64>().ok())
    .unwrap_or_default();

  let mut snapshot = Map::new();
  snapshot.insert(
    "schemaVersion".into(),
    Value::from(schema_version.parse::<i64>().unwrap_or(1)),
  );
  snapshot.insert("localVaultId".into(), Value::from(local_vault_id));
  snapshot.insert("savedAt".into(), Value::from(saved_at));
  snapshot.insert(
    "projects".into(),
    parse_collection_value(&connection, "projects", Value::Array(Vec::new()))?,
  );
  snapshot.insert(
    "folders".into(),
    parse_collection_value(&connection, "folders", Value::Array(Vec::new()))?,
  );
  snapshot.insert(
    "tags".into(),
    parse_collection_value(&connection, "tags", Value::Array(Vec::new()))?,
  );
  snapshot.insert(
    "notes".into(),
    parse_collection_value(&connection, "notes", Value::Array(Vec::new()))?,
  );
  snapshot.insert(
    "assets".into(),
    parse_collection_value(&connection, "assets", Value::Array(Vec::new()))?,
  );
  snapshot.insert(
    "settings".into(),
    parse_collection_value(&connection, "settings", Value::Null)?,
  );
  snapshot.insert(
    "syncDirtyEntries".into(),
    parse_collection_value(&connection, "syncDirtyEntries", Value::Array(Vec::new()))?,
  );
  snapshot.insert(
    "syncShadows".into(),
    parse_collection_value(&connection, "syncShadows", Value::Array(Vec::new()))?,
  );
  snapshot.insert(
    "syncTombstones".into(),
    parse_collection_value(&connection, "syncTombstones", Value::Array(Vec::new()))?,
  );

  Ok(Some(Value::Object(snapshot).to_string()))
}

#[tauri::command]
fn native_vault_store_write<R: Runtime>(
  app: AppHandle<R>,
  local_vault_id: String,
  snapshot_json: String,
) -> Result<(), String> {
  let snapshot: Value = serde_json::from_str(&snapshot_json)
    .map_err(|error| format!("failed to decode native vault snapshot payload: {error}"))?;
  let snapshot_object = snapshot
    .as_object()
    .ok_or_else(|| "native vault snapshot must be a JSON object".to_string())?;
  let database_path = native_vault_database_path(&app, &local_vault_id)?;
  ensure_parent_directory(&database_path)?;

  let mut connection = Connection::open(&database_path)
    .map_err(|error| format!("failed to open native vault database: {error}"))?;
  ensure_native_vault_schema(&connection)?;

  let transaction = connection
    .transaction()
    .map_err(|error| format!("failed to open native vault transaction: {error}"))?;

  transaction
    .execute("DELETE FROM metadata", [])
    .map_err(|error| format!("failed to clear native vault metadata: {error}"))?;
  transaction
    .execute("DELETE FROM collections", [])
    .map_err(|error| format!("failed to clear native vault collections: {error}"))?;

  let schema_version = snapshot_object
    .get("schemaVersion")
    .and_then(Value::as_i64)
    .unwrap_or(1);
  let persisted_local_vault_id = snapshot_object
    .get("localVaultId")
    .and_then(Value::as_str)
    .unwrap_or(local_vault_id.as_str())
    .to_string();
  let saved_at = snapshot_object
    .get("savedAt")
    .and_then(Value::as_i64)
    .unwrap_or_default();
  let projects = snapshot_object
    .get("projects")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));
  let folders = snapshot_object
    .get("folders")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));
  let tags = snapshot_object
    .get("tags")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));
  let notes = snapshot_object
    .get("notes")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));
  let assets = snapshot_object
    .get("assets")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));
  let settings = snapshot_object.get("settings").cloned().unwrap_or(Value::Null);
  let sync_dirty_entries = snapshot_object
    .get("syncDirtyEntries")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));
  let sync_shadows = snapshot_object
    .get("syncShadows")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));
  let sync_tombstones = snapshot_object
    .get("syncTombstones")
    .cloned()
    .unwrap_or(Value::Array(Vec::new()));

  write_metadata_value(&transaction, "schemaVersion", &schema_version.to_string())?;
  write_metadata_value(&transaction, "localVaultId", &persisted_local_vault_id)?;
  write_metadata_value(&transaction, "savedAt", &saved_at.to_string())?;
  write_collection_value(&transaction, "projects", &projects)?;
  write_collection_value(&transaction, "folders", &folders)?;
  write_collection_value(&transaction, "tags", &tags)?;
  write_collection_value(&transaction, "notes", &notes)?;
  write_collection_value(&transaction, "assets", &assets)?;
  write_collection_value(&transaction, "settings", &settings)?;
  write_collection_value(&transaction, "syncDirtyEntries", &sync_dirty_entries)?;
  write_collection_value(&transaction, "syncShadows", &sync_shadows)?;
  write_collection_value(&transaction, "syncTombstones", &sync_tombstones)?;

  transaction
    .commit()
    .map_err(|error| format!("failed to commit native vault transaction: {error}"))
}

#[tauri::command]
fn native_vault_store_delete<R: Runtime>(
  app: AppHandle<R>,
  local_vault_id: String,
) -> Result<(), String> {
  let database_path = native_vault_database_path(&app, &local_vault_id)?;

  for suffix in ["", "-wal", "-shm"] {
    let path = if suffix.is_empty() {
      database_path.clone()
    } else {
      PathBuf::from(format!("{}{}", database_path.display(), suffix))
    };

    if path.exists() {
      fs::remove_file(&path)
        .map_err(|error| format!("failed to remove native vault database file: {error}"))?;
    }
  }

  if let Some(parent_directory) = database_path.parent() {
    if parent_directory.exists() && parent_directory.read_dir().map_err(|error| format!("{error}"))?.next().is_none()
    {
      let _ = fs::remove_dir(parent_directory);
    }
  }

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let log_level = if cfg!(debug_assertions) {
    log::LevelFilter::Info
  } else {
    log::LevelFilter::Warn
  };

  let mut log_targets = vec![Target::new(TargetKind::LogDir {
    file_name: Some("locoris".into()),
  })];

  if cfg!(debug_assertions) {
    log_targets.push(Target::new(TargetKind::Stdout));
  }

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      native_vault_store_read,
      native_vault_store_write,
      native_vault_store_delete
    ])
    .plugin(tauri_plugin_fs::init())
    .plugin(
      tauri_plugin_log::Builder::new()
        .clear_targets()
        .targets(log_targets)
        .level(log_level)
        .build(),
    )
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      ensure_runtime_layout(app)?;
      create_main_window(app)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Locoris desktop application");
}
