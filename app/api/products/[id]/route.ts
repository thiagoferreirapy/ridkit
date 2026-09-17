import { getDb } from "@/lib/db";
import { apiError, ok, parseId, slugify } from "@/lib/api";
import { adminProductPatchSchema } from "@/lib/schemas";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try { const {id:idValue}=await params; const idOrSlug=/^\d+$/.test(idValue)?Number(idValue):idValue; const column=typeof idOrSlug==="number"?"p.id":"p.slug"; const db=getDb();
    const product=db.prepare(`SELECT p.*,b.name AS brand,b.slug AS brand_slug,c.name AS category,c.slug AS category_slug,c.variation_type,c.variation_label FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE ${column}=?`).get(idOrSlug) as Record<string,unknown>|undefined;
    if(!product)throw new Error("NOT_FOUND"); const productId=Number(product.id);
    return ok({...product,images:db.prepare("SELECT id,url,alt,photographer,photographer_url,position FROM product_images WHERE product_id=? ORDER BY position").all(productId),variants:db.prepare("SELECT id,sku,size,color,stock,reserved_stock,price_cents,active FROM product_variants WHERE product_id=? ORDER BY id").all(productId),reviews:db.prepare("SELECT r.id,r.rating,r.title,r.comment,r.verified,r.created_at,c.name AS customer FROM reviews r JOIN customers c ON c.id=r.customer_id WHERE r.product_id=? AND r.approved=1 ORDER BY r.created_at DESC LIMIT 20").all(productId)});
  } catch(error){return apiError(error);}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const db=getDb();
  try { await requireAdmin(["admin","manager"]); const {id}=await params; const productId=parseId(id); const value=adminProductPatchSchema.parse(await request.json()); const {images,variants,...fields}=value;
    if(fields.compare_at_cents===0)fields.compare_at_cents=null;
    const entries=Object.entries(fields); if(!entries.length&&!images&&!variants)throw new Error("BAD_REQUEST:Nenhum campo para atualizar");
    const allowed=["brand_id","category_id","name","slug","sku","description","price_cents","compare_at_cents","cost_cents","color","finish","shell_material","weight_grams","solar_visor","pinlock_ready","featured","is_new","launch_starts_at","launch_ends_at","offer_starts_at","offer_ends_at","active","publication_status","seo_title","seo_description","seo_image_url"];
    const clean=entries.filter(([key])=>allowed.includes(key)); if(value.name&&!value.slug)clean.push(["slug",slugify(value.name)]);
    db.exec("BEGIN IMMEDIATE");
    if(clean.length){const result=db.prepare(`UPDATE products SET ${clean.map(([k])=>`${k}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...clean.map(([,v])=>v??null),productId);if(!result.changes)throw new Error("NOT_FOUND");}
    if(images){db.prepare("DELETE FROM product_images WHERE product_id=?").run(productId);const insert=db.prepare("INSERT INTO product_images(product_id,url,alt,photographer,photographer_url,position) VALUES(?,?,?,?,?,?)");images.forEach((image,index)=>insert.run(productId,image.url,image.alt,image.photographer??null,image.photographer_url??null,index));}
    if(variants){const kept:number[]=[];const update=db.prepare("UPDATE product_variants SET sku=?,size=?,color=?,stock=?,reserved_stock=?,price_cents=?,active=? WHERE id=? AND product_id=?");const insert=db.prepare("INSERT INTO product_variants(product_id,sku,size,color,stock,reserved_stock,price_cents,active) VALUES(?,?,?,?,?,?,?,?)");for(const variant of variants){if(variant.id){update.run(variant.sku,variant.size,variant.color,variant.stock,variant.reserved_stock,variant.price_cents??null,variant.active,variant.id,productId);kept.push(variant.id);}else{const result=insert.run(productId,variant.sku,variant.size,variant.color,variant.stock,variant.reserved_stock,variant.price_cents??null,variant.active);kept.push(Number(result.lastInsertRowid));}}if(kept.length)db.prepare(`UPDATE product_variants SET active=0 WHERE product_id=? AND id NOT IN (${kept.map(()=>"?").join(",")})`).run(productId,...kept);}
    db.exec("COMMIT");return ok({id:productId,updated:true});
  } catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}) {
  await requireAdmin(["admin"]);
  try { const {id}=await params; const productId=parseId(id); const result=getDb().prepare("UPDATE products SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(productId); if(!result.changes)throw new Error("NOT_FOUND"); return ok({id:productId,deleted:true,mode:"soft-delete"}); } catch(error){return apiError(error);}
}
