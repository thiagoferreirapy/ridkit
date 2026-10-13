import { DatabaseSync } from "node:sqlite";
import { cp, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "ridekit.sqlite");
if (!existsSync(databasePath)) {
  console.error(JSON.stringify({ level: "error", event: "backup.failed", reason: "database_not_found", database: databasePath }));
  process.exit(1);
}

const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = path.resolve("backups", stamp);
await mkdir(destination, { recursive: true });

// VACUUM INTO writes a consistent snapshot even while the app holds the WAL open.
const target = path.join(destination, path.basename(databasePath));
const db = new DatabaseSync(databasePath, { timeout: 5000 });
try { db.prepare("VACUUM INTO ?").run(target); } finally { db.close(); }

let uploads = false;
try { await stat("public/uploads"); await cp("public/uploads", path.join(destination, "uploads"), { recursive: true }); uploads = true; } catch (error) { if (error.code !== "ENOENT") throw error; }

const { size } = await stat(target);
console.log(JSON.stringify({ level: "info", event: "backup.completed", destination, database_bytes: size, uploads, timestamp: new Date().toISOString() }));
