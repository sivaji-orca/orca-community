import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(import.meta.dir, "../../data");

let _db: Database | null = null;

function initDb(): Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const dbPath = path.join(DATA_DIR, "dhurandhar.db");
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
    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      run_at TEXT DEFAULT (datetime('now')),
      total INTEGER DEFAULT 0,
      passed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      results_json TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      endpoint TEXT,
      method TEXT,
      status_code INTEGER,
      response_time_ms INTEGER,
      project_name TEXT
    )
  `);

  return db;
}

export function getDb(): Database {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}
