import { getDb } from "@/lib/db";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export function GET() { const db=getDb(); return ok({
  brands:db.prepare("SELECT b.*,COUNT(p.id) AS product_count FROM brands b LEFT JOIN products p ON p.brand_id=b.id AND p.active=1 WHERE b.active=1 GROUP BY b.id ORDER BY b.name").all(),
  categories:db.prepare("SELECT c.*,COUNT(DISTINCT p.id) AS product_count,CASE WHEN c.variation_type='size' THEN 1 ELSE 0 END AS has_sizes FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.active=1 WHERE c.active=1 GROUP BY c.id ORDER BY c.name").all(),
  sizes:db.prepare("SELECT v.size,COUNT(DISTINCT v.product_id) AS product_count FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.active=1 AND p.active=1 AND v.size<>'Único' GROUP BY v.size ORDER BY CASE v.size WHEN '56 / S' THEN 1 WHEN '58 / M' THEN 2 WHEN '60 / L' THEN 3 WHEN '62 / XL' THEN 4 ELSE 5 END").all(),
  filter_products:db.prepare(`SELECT p.id,p.price_cents,p.featured,c.slug AS category_slug,b.slug AS brand_slug,
    (CASE WHEN c.variation_type='size' THEN (SELECT GROUP_CONCAT(size,'|') FROM (SELECT DISTINCT pv.size AS size FROM product_variants pv WHERE pv.product_id=p.id AND pv.active=1 AND pv.size<>'Único')) END) AS sizes_csv
    FROM products p JOIN categories c ON c.id=p.category_id JOIN brands b ON b.id=p.brand_id WHERE p.active=1`).all(),
  featured:db.prepare(`SELECT p.id,p.name,p.slug,p.price_cents,p.rating,b.name AS brand,(SELECT url FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS image_url FROM products p JOIN brands b ON b.id=p.brand_id WHERE p.active=1 AND p.featured=1 ORDER BY p.rating DESC LIMIT 12`).all(),
}); }
