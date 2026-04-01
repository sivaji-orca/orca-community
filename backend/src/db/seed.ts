import bcryptjs from "bcryptjs";
import { getDb } from "./schema";

const db = getDb();

const users = [
  { username: "admin", password: "admin", role: "administrator" },
  { username: "developer", password: "developer", role: "developer" },
];

for (const u of users) {
  const exists = db.query("SELECT id FROM users WHERE username = ?").get(u.username);
  if (!exists) {
    const hash = bcryptjs.hashSync(u.password, 10);
    db.run(
      "INSERT INTO users (username, password_hash, role, created_by) VALUES (?, ?, ?, ?)",
      [u.username, hash, u.role, "system"]
    );
    console.log(`User '${u.username}' (${u.role}) created.`);
  } else {
    console.log(`User '${u.username}' already exists.`);
  }
}

db.close();
console.log("Seed complete.");
