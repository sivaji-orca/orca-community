import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(import.meta.dir, "../../data");

let _db: Database | null = null;

function initDb(): Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const dbPath = path.join(DATA_DIR, "orca.db");
  const db = new Database(dbPath, { create: true });

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('administrator', 'developer')),
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      is_default INTEGER DEFAULT 0
    )
  `);

  const defaultWs = db.query("SELECT id FROM workspaces WHERE is_default = 1").get();
  if (!defaultWs) {
    db.run(
      "INSERT INTO workspaces (name, description, created_by, is_default) VALUES (?, ?, ?, 1)",
      ["Default", "Default workspace", "system"]
    );
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      run_at TEXT DEFAULT (datetime('now')),
      total INTEGER DEFAULT 0,
      passed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      results_json TEXT,
      workspace_id INTEGER DEFAULT 1 REFERENCES workspaces(id)
    )
  `);

  migrateColumn(db, "test_runs", "workspace_id", "INTEGER DEFAULT 1 REFERENCES workspaces(id)");

  db.run(`
    CREATE TABLE IF NOT EXISTS api_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      endpoint TEXT,
      method TEXT,
      status_code INTEGER,
      response_time_ms INTEGER,
      project_name TEXT,
      workspace_id INTEGER DEFAULT 1 REFERENCES workspaces(id)
    )
  `);

  migrateColumn(db, "api_metrics", "workspace_id", "INTEGER DEFAULT 1 REFERENCES workspaces(id)");

  db.run(`
    CREATE TABLE IF NOT EXISTS branding (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      app_name TEXT NOT NULL DEFAULT 'Orca Community Edition',
      app_short_name TEXT NOT NULL DEFAULT 'Orca',
      description TEXT DEFAULT 'MuleSoft Developer Productivity Tool',
      logo_svg TEXT,
      repo_name TEXT,
      forked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scan_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      source_url TEXT,
      scanned_at TEXT DEFAULT (datetime('now')),
      total_findings INTEGER DEFAULT 0,
      critical_count INTEGER DEFAULT 0,
      warning_count INTEGER DEFAULT 0,
      info_count INTEGER DEFAULT 0,
      health_score INTEGER DEFAULT 0,
      migration_ready INTEGER DEFAULT 0,
      results_json TEXT,
      workspace_id INTEGER DEFAULT 1 REFERENCES workspaces(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER REFERENCES scan_results(id),
      source_path TEXT NOT NULL,
      target_workspace_id INTEGER REFERENCES workspaces(id),
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','failed')),
      plan_json TEXT,
      result_json TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dw_snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      script TEXT NOT NULL,
      sample_input TEXT DEFAULT '{}',
      input_mime TEXT DEFAULT 'application/json',
      output_mime TEXT DEFAULT 'application/json',
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      workspace_id INTEGER DEFAULT 1 REFERENCES workspaces(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dw_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script TEXT NOT NULL,
      input_data TEXT,
      input_mime TEXT DEFAULT 'application/json',
      output_mime TEXT DEFAULT 'application/json',
      output_data TEXT,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      execution_time_ms INTEGER DEFAULT 0,
      engine TEXT DEFAULT 'unknown',
      executed_at TEXT DEFAULT (datetime('now')),
      workspace_id INTEGER DEFAULT 1 REFERENCES workspaces(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vault_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correlation_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('read', 'write', 'delete')),
      secret_key TEXT NOT NULL,
      user_id TEXT,
      ip_address TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  return db;
}

function migrateColumn(db: Database, table: string, column: string, definition: string): void {
  const cols = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb(): Database {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}
