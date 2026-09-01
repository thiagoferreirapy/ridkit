import { getDb } from "@/lib/db";
import { apiError, ok, parseId, slugify } from "@/lib/api";
import { productPatchSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try { const {id:idValue}=await params; const idOrSlug=/^\d+$/.test(idValue)?Number(idValue):idValue; const column=typeof idOrSlug==="number"?"p.id":"p.slug"; const db=getDb();
    const product=db.prepare(`SELECT p.*,b.name AS brand,b.slug AS brand_slug,c.name AS category,c.slug AS category_slug FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE ${column}=?`).get(idOrSlug) as Record<string,unknown>|undefined;
    if(!product)throw new Error("NOT_FOUND"); const productId=Number(product.id);
    return ok({...product,images:db.prepare("SELECT id,url,alt,photographer,photographer_url,position FROM product_images WHERE product_id=? ORDER BY position").all(productId),variants:db.prepare("SELECT id,sku,size,color,stock,reserved_stock,price_cents,active FROM product_variants WHERE product_id=? ORDER BY id").all(productId),reviews:db.prepare("SELECT r.id,r.rating,r.title,r.comment,r.verified,r.created_at,c.name AS customer FROM reviews r JOIN customers c ON c.id=r.customer_id WHERE r.product_id=? AND r.approved=1 ORDER BY r.created_at DESC LIMIT 20").all(productId)});
  } catch(error){return apiError(error);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  try { const {id}=await params; const productId=parseId(id); const value=productPatchSchema.parse(await request.json()); const entries=Object.entries(value); if(!entries.length)throw new Error("BAD_REQUEST:Nenhum campo para atualizar");
    const allowed=["brand_id","category_id","name","slug","sku","description","price_cents","compare_at_cents","cost_cents","color","finish","shell_material","weight_grams","solar_visor","pinlock_ready","featured","active"];
    const clean=entries.filter(([key])=>allowed.includes(key)); if(value.name&&!value.slug)clean.push(["slug",slugify(value.name)]);
    const result=getDb().prepare(`UPDATE products SET ${clean.map(([k])=>`${k}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...clean.map(([,v])=>v??null),productId); if(!result.changes)throw new Error("NOT_FOUND"); return ok({id:productId,updated:true});
  } catch(error){return apiError(error);}
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try { const {id}=await params; const productId=parseId(id); const result=getDb().prepare("UPDATE products SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(productId); if(!result.changes)throw new Error("NOT_FOUND"); return ok({id:productId,deleted:true,mode:"soft-delete"}); } catch(error){return apiError(error);}
}
