import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "../../lib/db.ts";

// In-memory database with the full production schema and migrations applied.
export function testDb() {
  return initializeDatabase(new DatabaseSync(":memory:"));
}

export function insertCustomer(db: DatabaseSync, id = 1, email = `cliente${id}@example.com`) {
  db.prepare("INSERT INTO customers(id,name,email,email_verified_at) VALUES(?,?,?,CURRENT_TIMESTAMP)").run(id, `Cliente ${id}`, email);
  return id;
}

export function insertVariant(db: DatabaseSync, { stock = 10, reserved = 0, priceCents = 10000 } = {}) {
  db.prepare("INSERT OR IGNORE INTO brands(id,name,slug) VALUES(1,'Marca','marca')").run();
  db.prepare("INSERT OR IGNORE INTO categories(id,name,slug) VALUES(1,'Categoria','categoria')").run();
  const product = db.prepare("INSERT INTO products(brand_id,category_id,name,slug,sku,description,price_cents,color) VALUES(1,1,'Produto',?,?,'Descrição',?,'Preto')").run(`p-${Math.random().toString(36).slice(2)}`, `SKU-${Math.random().toString(36).slice(2)}`, priceCents);
  const variant = db.prepare("INSERT INTO product_variants(product_id,sku,size,color,stock,reserved_stock,price_cents) VALUES(?,?,'M','Preto',?,?,?)").run(product.lastInsertRowid, `V-${Math.random().toString(36).slice(2)}`, stock, reserved, priceCents);
  return { productId: Number(product.lastInsertRowid), variantId: Number(variant.lastInsertRowid) };
}
