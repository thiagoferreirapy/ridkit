import { getDb } from "@/lib/db";
import { apiError, created, ok } from "@/lib/api";
import { z } from "zod";

export const runtime="nodejs";

const favoriteSchema=z.object({session_id:z.string().min(6).max(120),product_id:z.coerce.number().int().positive()});

function favoritePayload(sessionId:string){return getDb().prepare(`SELECT p.id,p.slug,p.name,p.price_cents,p.compare_at_cents,p.featured,b.name AS brand,c.name AS category,
  (SELECT url FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS image_url,
  (SELECT photographer FROM product_images WHERE product_id=p.id ORDER BY position LIMIT 1) AS photographer,
  (SELECT GROUP_CONCAT(size,'|') FROM (SELECT DISTINCT v.size AS size FROM product_variants v WHERE v.product_id=p.id AND v.active=1 AND v.size<>'Único')) AS sizes_csv
  FROM favorite_items f JOIN products p ON p.id=f.product_id JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id
  WHERE f.session_id=? AND p.active=1 ORDER BY f.created_at DESC`).all(sessionId);}

export function GET(request:Request){try{const sessionId=new URL(request.url).searchParams.get("session_id");if(!sessionId)throw new Error("BAD_REQUEST:session_id é obrigatório");return ok({items:favoritePayload(sessionId)});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{const value=favoriteSchema.parse(await request.json());const db=getDb();const product=db.prepare("SELECT id FROM products WHERE id=? AND active=1").get(value.product_id);if(!product)throw new Error("NOT_FOUND");db.prepare("INSERT OR IGNORE INTO favorite_items(session_id,product_id) VALUES(?,?)").run(value.session_id,value.product_id);return created({items:favoritePayload(value.session_id)});}catch(error){return apiError(error);}}
export async function DELETE(request:Request){try{const value=favoriteSchema.parse(await request.json());getDb().prepare("DELETE FROM favorite_items WHERE session_id=? AND product_id=?").run(value.session_id,value.product_id);return ok({items:favoritePayload(value.session_id)});}catch(error){return apiError(error);}}
