import { getDb } from "@/lib/db";
import { apiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const runtime="nodejs";

export async function GET(){
  try{
    const customerId=(await requireUser()).id; const db=getDb();
    const customer=db.prepare("SELECT id,name,email,cpf,phone,created_at FROM customers WHERE id=?").get(customerId);
    if(!customer)throw new Error("NOT_FOUND");
    const addresses=db.prepare("SELECT * FROM addresses WHERE customer_id=? ORDER BY is_default DESC,id").all(customerId);
    const coupons=db.prepare("SELECT id,code,description,discount_type,discount_value,min_order_cents,ends_at FROM coupons WHERE active=1 AND (ends_at IS NULL OR ends_at>=date('now')) ORDER BY min_order_cents,id").all();
    const orders=db.prepare(`SELECT o.id,o.order_number,o.status,o.payment_status,o.total_cents,o.created_at,o.tracking_code,
      (SELECT product_name FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) AS product_name,
      (SELECT variant_name FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) AS variant_name,
      (SELECT pi.url FROM order_items oi JOIN product_images pi ON pi.product_id=oi.product_id AND pi.position=0 WHERE oi.order_id=o.id LIMIT 1) AS image_url
      FROM orders o WHERE o.customer_id=? ORDER BY o.created_at DESC`).all(customerId);
    return ok({customer,addresses,coupons,orders,summary:{orders:orders.length,in_transit:(orders as {status:string}[]).filter(order=>order.status==="shipped").length,addresses:addresses.length}});
  }catch(error){return apiError(error);}
}

export async function PATCH(request:Request){
  try{const customerId=(await requireUser()).id;const body=await request.json();const name=String(body.name||"").trim();const email=String(body.email||"").trim().toLowerCase();const phone=String(body.phone||"").trim();if(name.length<2||!email.includes("@"))throw new Error("VALIDATION:Preencha nome e e-mail válidos");getDb().prepare("UPDATE customers SET name=?,email=?,phone=? WHERE id=?").run(name,email,phone||null,customerId);return ok({saved:true});}
  catch(error){if(error instanceof Error&&/UNIQUE/.test(error.message))return apiError(new Error("CONFLICT:Este e-mail já está em uso"));return apiError(error);}
}

export async function POST(request:Request){
  const db=getDb();
  try{const customerId=(await requireUser()).id;const body=await request.json();const required=["label","zip_code","street","number","district","city","state"] as const;for(const field of required)if(!String(body[field]||"").trim())throw new Error("VALIDATION:Preencha todos os campos obrigatórios do endereço");db.exec("BEGIN IMMEDIATE");if(body.is_default)db.prepare("UPDATE addresses SET is_default=0 WHERE customer_id=?").run(customerId);const result=db.prepare("INSERT INTO addresses(customer_id,label,zip_code,street,number,complement,district,city,state,is_default) VALUES(?,?,?,?,?,?,?,?,?,?)").run(customerId,String(body.label).trim(),String(body.zip_code).trim(),String(body.street).trim(),String(body.number).trim(),String(body.complement||"").trim()||null,String(body.district).trim(),String(body.city).trim(),String(body.state).trim().toUpperCase(),body.is_default?1:0);db.exec("COMMIT");return ok({id:Number(result.lastInsertRowid)});}
  catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}
}
