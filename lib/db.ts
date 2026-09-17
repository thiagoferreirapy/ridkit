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
    if (!categoryColumns.some(column => column.name === "sort_order")) db.exec("ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    if (!categoryColumns.some(column => column.name === "seo_title")) db.exec("ALTER TABLE categories ADD COLUMN seo_title TEXT");
    if (!categoryColumns.some(column => column.name === "seo_description")) db.exec("ALTER TABLE categories ADD COLUMN seo_description TEXT");
    db.exec("UPDATE categories SET variation_type='size',variation_label='Tamanho' WHERE slug IN ('fechados','articulados','abertos','off-road') AND variation_type='none'");
    const productColumns = db.prepare("PRAGMA table_info(products)").all() as { name:string }[];
    if (!productColumns.some(column => column.name === "is_new")) db.exec("ALTER TABLE products ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0 CHECK(is_new IN (0,1))");
    if (!productColumns.some(column => column.name === "launch_starts_at")) db.exec("ALTER TABLE products ADD COLUMN launch_starts_at TEXT");
    if (!productColumns.some(column => column.name === "launch_ends_at")) db.exec("ALTER TABLE products ADD COLUMN launch_ends_at TEXT");
    if (!productColumns.some(column => column.name === "offer_starts_at")) db.exec("ALTER TABLE products ADD COLUMN offer_starts_at TEXT");
    if (!productColumns.some(column => column.name === "offer_ends_at")) db.exec("ALTER TABLE products ADD COLUMN offer_ends_at TEXT");
    if (!productColumns.some(column => column.name === "publication_status")) db.exec("ALTER TABLE products ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'active'");
    if (!productColumns.some(column => column.name === "seo_title")) db.exec("ALTER TABLE products ADD COLUMN seo_title TEXT");
    if (!productColumns.some(column => column.name === "seo_description")) db.exec("ALTER TABLE products ADD COLUMN seo_description TEXT");
    if (!productColumns.some(column => column.name === "seo_image_url")) db.exec("ALTER TABLE products ADD COLUMN seo_image_url TEXT");
    const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as { name:string }[];
    if (!orderColumns.some(column => column.name === "shipping_rule_id")) db.exec("ALTER TABLE orders ADD COLUMN shipping_rule_id INTEGER");
    if (!orderColumns.some(column => column.name === "shipping_rule_name")) db.exec("ALTER TABLE orders ADD COLUMN shipping_rule_name TEXT");
    if (!orderColumns.some(column => column.name === "payment_provider")) db.exec("ALTER TABLE orders ADD COLUMN payment_provider TEXT");
    if (!orderColumns.some(column => column.name === "provider_payment_id")) db.exec("ALTER TABLE orders ADD COLUMN provider_payment_id TEXT");
    if (!orderColumns.some(column => column.name === "pix_qr_code")) db.exec("ALTER TABLE orders ADD COLUMN pix_qr_code TEXT");
    if (!orderColumns.some(column => column.name === "pix_qr_image")) db.exec("ALTER TABLE orders ADD COLUMN pix_qr_image TEXT");
    if (!orderColumns.some(column => column.name === "pix_expires_at")) db.exec("ALTER TABLE orders ADD COLUMN pix_expires_at TEXT");
    if (!orderColumns.some(column => column.name === "payment_updated_at")) db.exec("ALTER TABLE orders ADD COLUMN payment_updated_at TEXT");
    if (!orderColumns.some(column => column.name === "idempotency_key")) db.exec("ALTER TABLE orders ADD COLUMN idempotency_key TEXT");
    const whatsappColumns = db.prepare("PRAGMA table_info(whatsapp_requests)").all() as { name:string }[];
    if (!whatsappColumns.some(column => column.name === "customer_zip_code")) db.exec("ALTER TABLE whatsapp_requests ADD COLUMN customer_zip_code TEXT");
    if (!whatsappColumns.some(column => column.name === "shipping_rule_id")) db.exec("ALTER TABLE whatsapp_requests ADD COLUMN shipping_rule_id INTEGER");
    if (!whatsappColumns.some(column => column.name === "shipping_rule_name")) db.exec("ALTER TABLE whatsapp_requests ADD COLUMN shipping_rule_name TEXT");
    const customerColumns = db.prepare("PRAGMA table_info(customers)").all() as { name:string }[];
    if (!customerColumns.some(column => column.name === "email_verified_at")) {
      db.exec("ALTER TABLE customers ADD COLUMN email_verified_at TEXT");
      db.exec("UPDATE customers SET email_verified_at=CURRENT_TIMESTAMP WHERE email_verified_at IS NULL");
    }
    if (!customerColumns.some(column => column.name === "asaas_customer_id")) db.exec("ALTER TABLE customers ADD COLUMN asaas_customer_id TEXT");
    const variantColumns = db.prepare("PRAGMA table_info(product_variants)").all() as { name:string }[];
    if (!variantColumns.some(column => column.name === "min_stock")) db.exec("ALTER TABLE product_variants ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0");
    db.exec("CREATE TABLE IF NOT EXISTS inventory_movements (id INTEGER PRIMARY KEY AUTOINCREMENT,variant_id INTEGER NOT NULL REFERENCES product_variants(id),order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,movement_type TEXT NOT NULL CHECK(movement_type IN ('entry','sale','reservation','release','adjustment','return')),quantity INTEGER NOT NULL,stock_after INTEGER,reserved_after INTEGER,reason TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(customer_id,idempotency_key) WHERE idempotency_key IS NOT NULL");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_payment_id ON orders(provider_payment_id) WHERE provider_payment_id IS NOT NULL");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_asaas_customer_id ON customers(asaas_customer_id) WHERE asaas_customer_id IS NOT NULL");
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
