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
    const categoryColumns = db.prepare("PRAGMA table_info(categories)").all() as { name:string }[];
    if (!categoryColumns.some(column => column.name === "variation_type")) db.exec("ALTER TABLE categories ADD COLUMN variation_type TEXT NOT NULL DEFAULT 'none' CHECK(variation_type IN ('none','size','option'))");
    if (!categoryColumns.some(column => column.name === "variation_label")) db.exec("ALTER TABLE categories ADD COLUMN variation_label TEXT");
    db.exec("UPDATE categories SET variation_type='size',variation_label='Tamanho' WHERE slug IN ('fechados','articulados','abertos','off-road') AND variation_type='none'");
    const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as { name:string }[];
    if (!orderColumns.some(column => column.name === "shipping_rule_id")) db.exec("ALTER TABLE orders ADD COLUMN shipping_rule_id INTEGER");
    if (!orderColumns.some(column => column.name === "shipping_rule_name")) db.exec("ALTER TABLE orders ADD COLUMN shipping_rule_name TEXT");
    const whatsappColumns = db.prepare("PRAGMA table_info(whatsapp_requests)").all() as { name:string }[];
    if (!whatsappColumns.some(column => column.name === "customer_zip_code")) db.exec("ALTER TABLE whatsapp_requests ADD COLUMN customer_zip_code TEXT");
    if (!whatsappColumns.some(column => column.name === "shipping_rule_id")) db.exec("ALTER TABLE whatsapp_requests ADD COLUMN shipping_rule_id INTEGER");
    if (!whatsappColumns.some(column => column.name === "shipping_rule_name")) db.exec("ALTER TABLE whatsapp_requests ADD COLUMN shipping_rule_name TEXT");
    const customerColumns = db.prepare("PRAGMA table_info(customers)").all() as { name:string }[];
    if (!customerColumns.some(column => column.name === "email_verified_at")) {
      db.exec("ALTER TABLE customers ADD COLUMN email_verified_at TEXT");
      db.exec("UPDATE customers SET email_verified_at=CURRENT_TIMESTAMP WHERE email_verified_at IS NULL");
    }
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
