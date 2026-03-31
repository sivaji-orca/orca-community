import bcryptjs from "bcryptjs";
import { getDb } from "./schema";

const db = getDb();

const adminExists = db.query("SELECT id FROM users WHERE username = ?").get("sivaji");
if (!adminExists) {
  const hash = bcryptjs.hashSync("nandutech", 10);
  db.run(
    "INSERT INTO users (username, password_hash, role, created_by) VALUES (?, ?, ?, ?)",
    ["sivaji", hash, "administrator", "system"]
  );
  console.log("Admin user 'sivaji' created.");
} else {
  console.log("Admin user 'sivaji' already exists.");
}

db.close();
console.log("Seed complete.");
