import { getDb } from "@/lib/db";
import { apiError, created, ok, pagination, slugify } from "@/lib/api";
import { productSchema } from "@/lib/schemas";
import { requireAdminPermission } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const { page, limit, offset } = pagination(url.searchParams);
    const adminView=url.searchParams.get("admin")==="1"; if(adminView)await requireAdminPermission("catalog.view");
    const where = [adminView?"1=1":"p.active = 1 AND p.publication_status='active'"]; const params: (string|number)[] = [];
    const q = url.searchParams.get("q"); const brand = url.searchParams.get("brand"); const category = url.searchParams.get("category"); const size = url.searchParams.get("size");
    const min = Number(url.searchParams.get("min_price")); const max = Number(url.searchParams.get("max_price")); const featured = url.searchParams.get("featured"); const offer=url.searchParams.get("offer"); const newest=url.searchParams.get("new");
    if (q) { where.push("(p.name LIKE ? COLLATE NOCASE OR p.description LIKE ? COLLATE NOCASE OR p.sku LIKE ? COLLATE NOCASE OR b.name LIKE ? COLLATE NOCASE OR c.name LIKE ? COLLATE NOCASE)"); params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
    if (brand) { where.push("b.slug = ?"); params.push(brand); }
    if (category) { where.push("c.slug = ?"); params.push(category); }
    if (size) { where.push("EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id=p.id AND pv.active=1 AND pv.size=?)"); params.push(size); }
    if (Number.isFinite(min) && min > 0) { where.push("p.price_cents >= ?"); params.push(Math.round(min*100)); }
    if (Number.isFinite(max) && max > 0) { where.push("p.price_cents <= ?"); params.push(Math.round(max*100)); }
    if (featured === "1") where.push("p.featured = 1");
    if (offer === "1") where.push("p.compare_at_cents IS NOT NULL AND p.compare_at_cents > p.price_cents AND (p.offer_starts_at IS NULL OR datetime(p.offer_starts_at)<=CURRENT_TIMESTAMP) AND (p.offer_ends_at IS NULL OR datetime(p.offer_ends_at)>=CURRENT_TIMESTAMP)");
    if (newest === "1") where.push("p.is_new=1 AND (p.launch_starts_at IS NULL OR datetime(p.launch_starts_at)<=CURRENT_TIMESTAMP) AND (p.launch_ends_at IS NULL OR datetime(p.launch_ends_at)>=CURRENT_TIMESTAMP)");
    const sortMap:Record<string,string>={price_asc:"p.price_cents ASC",price_desc:"p.price_cents DESC",rating:"p.rating DESC",newest:"p.created_at DESC"};
    const order = newest === "1" ? "p.created_at DESC,p.id DESC" : sortMap[url.searchParams.get("sort")||""] || "p.featured DESC, p.id ASC";
    const db=getDb(); const whereSql=where.join(" AND ");
    const total=Number((db.prepare(`SELECT COUNT(*) AS count FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE ${whereSql}`).get(...params) as {count:number}).count);
    const data=db.prepare(`SELECT p.*, b.name AS brand, b.slug AS brand_slug, c.name AS category, c.slug AS category_slug,
      (SELECT url FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS image_url,
      (SELECT photographer FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS photographer,
      (CASE WHEN c.variation_type='size' THEN (SELECT GROUP_CONCAT(size,'|') FROM (SELECT DISTINCT pv.size AS size FROM product_variants pv WHERE pv.product_id=p.id AND pv.active=1 AND pv.size<>'Único' ORDER BY CASE pv.size WHEN '56 / S' THEN 1 WHEN '58 / M' THEN 2 WHEN '60 / L' THEN 3 WHEN '62 / XL' THEN 4 ELSE 5 END)) END) AS sizes_csv,
      COALESCE((SELECT SUM(stock-reserved_stock) FROM product_variants WHERE product_id=p.id AND active=1),0) AS available_stock
      FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
      WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params,limit,offset);
    return ok({ items:data, pagination:{page,limit,total,pages:Math.ceil(total/limit)} });
  } catch(error) { return apiError(error); }
}

export async function POST(request: Request) {
  const db=getDb();
  try {
    await requireAdminPermission("catalog.manage");
    const value=productSchema.parse(await request.json()); const productSlug=value.slug||slugify(value.name);
    db.exec("BEGIN IMMEDIATE");
    const result=db.prepare(`INSERT INTO products(brand_id,category_id,name,slug,sku,description,price_cents,compare_at_cents,cost_cents,color,finish,shell_material,weight_grams,solar_visor,pinlock_ready,featured,is_new,launch_starts_at,launch_ends_at,offer_starts_at,offer_ends_at,active,publication_status,seo_title,seo_description,seo_image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(value.brand_id,value.category_id,value.name,productSlug,value.sku,value.description,value.price_cents,value.compare_at_cents??null,value.cost_cents,value.color,value.finish??null,value.shell_material??null,value.weight_grams??null,value.solar_visor,value.pinlock_ready,value.featured,value.is_new,value.launch_starts_at??null,value.launch_ends_at??null,value.offer_starts_at??null,value.offer_ends_at??null,value.active,value.publication_status,value.seo_title??null,value.seo_description??null,value.seo_image_url??null);
    const productId=Number(result.lastInsertRowid); const imageStmt=db.prepare("INSERT INTO product_images(product_id,url,alt,photographer,photographer_url,position) VALUES(?,?,?,?,?,?)");
    value.images.forEach((img,i)=>imageStmt.run(productId,img.url,img.alt,img.photographer??null,img.photographer_url??null,i));
    const attributeStmt=db.prepare("INSERT INTO product_attributes(product_id,name,value,position) VALUES(?,?,?,?)");
    value.attributes.forEach((attribute,i)=>attributeStmt.run(productId,attribute.name,attribute.value,i));
    const variantStmt=db.prepare("INSERT INTO product_variants(product_id,sku,size,color,stock,price_cents) VALUES(?,?,?,?,?,?)");
    value.variants.forEach(v=>variantStmt.run(productId,v.sku,v.size,v.color,v.stock,v.price_cents??null)); db.exec("COMMIT");
    return created({id:productId,slug:productSlug});
  } catch(error) { if(db.isTransaction)db.exec("ROLLBACK"); if(error instanceof Error && /UNIQUE/.test(error.message))return apiError(new Error("CONFLICT:Slug ou SKU já cadastrado")); return apiError(error); }
}
