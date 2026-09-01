import { getDb } from "@/lib/db";
import { apiError, created, ok, pagination, slugify } from "@/lib/api";
import { productSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const { page, limit, offset } = pagination(url.searchParams);
    const where = ["p.active = 1"]; const params: (string|number)[] = [];
    const q = url.searchParams.get("q"); const brand = url.searchParams.get("brand"); const category = url.searchParams.get("category"); const size = url.searchParams.get("size");
    const min = Number(url.searchParams.get("min_price")); const max = Number(url.searchParams.get("max_price")); const featured = url.searchParams.get("featured");
    if (q) { where.push("(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)"); params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    if (brand) { where.push("b.slug = ?"); params.push(brand); }
    if (category) { where.push("c.slug = ?"); params.push(category); }
    if (size) { where.push("EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id=p.id AND pv.active=1 AND pv.size=?)"); params.push(size); }
    if (Number.isFinite(min) && min > 0) { where.push("p.price_cents >= ?"); params.push(Math.round(min*100)); }
    if (Number.isFinite(max) && max > 0) { where.push("p.price_cents <= ?"); params.push(Math.round(max*100)); }
    if (featured === "1") where.push("p.featured = 1");
    const sortMap:Record<string,string>={price_asc:"p.price_cents ASC",price_desc:"p.price_cents DESC",rating:"p.rating DESC",newest:"p.created_at DESC"};
    const order = sortMap[url.searchParams.get("sort")||""] || "p.featured DESC, p.id ASC";
    const db=getDb(); const whereSql=where.join(" AND ");
    const total=Number((db.prepare(`SELECT COUNT(*) AS count FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE ${whereSql}`).get(...params) as {count:number}).count);
    const data=db.prepare(`SELECT p.*, b.name AS brand, b.slug AS brand_slug, c.name AS category, c.slug AS category_slug,
      (SELECT url FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS image_url,
      (SELECT photographer FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS photographer,
      (SELECT GROUP_CONCAT(size,'|') FROM (SELECT DISTINCT pv.size AS size FROM product_variants pv WHERE pv.product_id=p.id AND pv.active=1 AND pv.size<>'Único' ORDER BY CASE pv.size WHEN '56 / S' THEN 1 WHEN '58 / M' THEN 2 WHEN '60 / L' THEN 3 WHEN '62 / XL' THEN 4 ELSE 5 END)) AS sizes_csv,
      COALESCE((SELECT SUM(stock-reserved_stock) FROM product_variants WHERE product_id=p.id AND active=1),0) AS available_stock
      FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
      WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params,limit,offset);
    return ok({ items:data, pagination:{page,limit,total,pages:Math.ceil(total/limit)} });
  } catch(error) { return apiError(error); }
}

export async function POST(request: Request) {
  const db=getDb();
  try {
    const value=productSchema.parse(await request.json()); const productSlug=value.slug||slugify(value.name);
    db.exec("BEGIN IMMEDIATE");
    const result=db.prepare(`INSERT INTO products(brand_id,category_id,name,slug,sku,description,price_cents,compare_at_cents,cost_cents,color,finish,shell_material,weight_grams,solar_visor,pinlock_ready,featured,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(value.brand_id,value.category_id,value.name,productSlug,value.sku,value.description,value.price_cents,value.compare_at_cents??null,value.cost_cents,value.color,value.finish??null,value.shell_material??null,value.weight_grams??null,value.solar_visor,value.pinlock_ready,value.featured,value.active);
    const productId=Number(result.lastInsertRowid); const imageStmt=db.prepare("INSERT INTO product_images(product_id,url,alt,photographer,photographer_url,position) VALUES(?,?,?,?,?,?)");
    value.images.forEach((img,i)=>imageStmt.run(productId,img.url,img.alt,img.photographer??null,img.photographer_url??null,i));
    const variantStmt=db.prepare("INSERT INTO product_variants(product_id,sku,size,color,stock,price_cents) VALUES(?,?,?,?,?,?)");
    value.variants.forEach(v=>variantStmt.run(productId,v.sku,v.size,v.color,v.stock,v.price_cents??null)); db.exec("COMMIT");
    return created({id:productId,slug:productSlug});
  } catch(error) { if(db.isTransaction)db.exec("ROLLBACK"); if(error instanceof Error && /UNIQUE/.test(error.message))return apiError(new Error("CONFLICT:Slug ou SKU já cadastrado")); return apiError(error); }
}
