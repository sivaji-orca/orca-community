import { describe, it, expect, beforeAll } from "bun:test";
import bcryptjs from "bcryptjs";
import { getDb } from "../db/schema";
import { signToken } from "../middleware/auth";

beforeAll(() => {
  const db = getDb();
  const exists = db.query("SELECT id FROM users WHERE username = ?").get("testadmin");
  if (!exists) {
    const hash = bcryptjs.hashSync("testpass", 10);
    db.run(
      "INSERT INTO users (username, password_hash, role, created_by) VALUES (?, ?, ?, ?)",
      ["testadmin", hash, "administrator", "test"]
    );
  }
  const devExists = db.query("SELECT id FROM users WHERE username = ?").get("testdev");
  if (!devExists) {
    const hash = bcryptjs.hashSync("testpass", 10);
    db.run(
      "INSERT INTO users (username, password_hash, role, created_by) VALUES (?, ?, ?, ?)",
      ["testdev", hash, "developer", "test"]
    );
  }
});

describe("Auth - signToken", () => {
  it("returns a JWT string", () => {
    const token = signToken({ userId: 1, username: "testadmin", role: "administrator" });
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("Auth - database", () => {
  it("can look up a user by username", () => {
    const db = getDb();
    const user = db.query("SELECT * FROM users WHERE username = ?").get("testadmin") as any;
    expect(user).toBeTruthy();
    expect(user.username).toBe("testadmin");
    expect(user.role).toBe("administrator");
  });

  it("verifies correct password", () => {
    const db = getDb();
    const user = db.query("SELECT * FROM users WHERE username = ?").get("testadmin") as any;
    expect(bcryptjs.compareSync("testpass", user.password_hash)).toBe(true);
  });

  it("rejects wrong password", () => {
    const db = getDb();
    const user = db.query("SELECT * FROM users WHERE username = ?").get("testadmin") as any;
    expect(bcryptjs.compareSync("wrongpass", user.password_hash)).toBe(false);
  });
});

describe("Auth - role validation", () => {
  it("stores correct role for admin user", () => {
    const db = getDb();
    const user = db.query("SELECT role FROM users WHERE username = ?").get("testadmin") as any;
    expect(user.role).toBe("administrator");
  });

  it("stores correct role for developer user", () => {
    const db = getDb();
    const user = db.query("SELECT role FROM users WHERE username = ?").get("testdev") as any;
    expect(user.role).toBe("developer");
  });
});
