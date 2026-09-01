import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const globalDb = globalThis as unknown as { ridekitDb?: DatabaseSync };

export const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "ridekit.sqlite");

export function getDb() {
  if (!globalDb.ridekitDb) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const db = new DatabaseSync(databasePath, { timeout: 5000 });
    db.exec(fs.readFileSync(path.join(process.cwd(), "data", "schema.sql"), "utf8"));
    globalDb.ridekitDb = db;
  }
  return globalDb.ridekitDb;
}

export function rows<T>(sql: string, ...params: (string | number | null)[]) {
  return getDb().prepare(sql).all(...params) as T[];
}

export function row<T>(sql: string, ...params: (string | number | null)[]) {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

export function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
