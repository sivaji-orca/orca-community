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
