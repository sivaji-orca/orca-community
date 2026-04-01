import { describe, it, expect } from "bun:test";
import { getDb } from "../db/schema";

describe("Database Schema", () => {
  it("initializes the database", () => {
    const db = getDb();
    expect(db).toBeTruthy();
  });

  it("creates users table with correct columns", () => {
    const db = getDb();
    const columns = db.query("PRAGMA table_info(users)").all() as any[];
    const colNames = columns.map((c) => c.name);
    expect(colNames).toContain("id");
    expect(colNames).toContain("username");
    expect(colNames).toContain("password_hash");
    expect(colNames).toContain("role");
    expect(colNames).toContain("created_by");
    expect(colNames).toContain("created_at");
  });

  it("creates test_runs table", () => {
    const db = getDb();
    const columns = db.query("PRAGMA table_info(test_runs)").all() as any[];
    expect(columns.length).toBeGreaterThan(0);
  });

  it("creates api_metrics table", () => {
    const db = getDb();
    const columns = db.query("PRAGMA table_info(api_metrics)").all() as any[];
    expect(columns.length).toBeGreaterThan(0);
  });

  it("returns the same db instance on repeated calls", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});
