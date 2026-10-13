import { getDb } from "@/lib/db";
import { apiError, ok } from "@/lib/api";
import { z } from "zod";
import { requireUser,verifyPassword } from "@/lib/auth";
import { activeCustomerCoupons } from "@/lib/coupons";
import { sendEmailChangeConfirmation } from "@/lib/email-verification";
import { appUrl } from "@/lib/env";
import { assertRateLimitFor } from "@/lib/rate-limit";

export const runtime="nodejs";

export async function GET(){
  try{
    const customerId=(await requireUser()).id; const db=getDb();
    const customer=db.prepare("SELECT id,name,email,cpf,phone,created_at FROM customers WHERE id=?").get(customerId);
    if(!customer)throw new Error("NOT_FOUND");
    const addresses=db.prepare("SELECT * FROM addresses WHERE customer_id=? ORDER BY is_default DESC,id").all(customerId);
    const coupons=activeCustomerCoupons(db,customerId);
    const orders=db.prepare(`SELECT o.id,o.order_number,o.status,o.payment_status,o.total_cents,o.created_at,o.tracking_code,
      (SELECT product_name FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) AS product_name,
      (SELECT variant_name FROM order_items WHERE order_id=o.id ORDER BY id LIMIT 1) AS variant_name,
      (SELECT pi.url FROM order_items oi JOIN product_images pi ON pi.product_id=oi.product_id AND pi.position=0 WHERE oi.order_id=o.id LIMIT 1) AS image_url
      FROM orders o WHERE o.customer_id=? ORDER BY o.created_at DESC`).all(customerId);
    return ok({customer,addresses,coupons,orders,summary:{orders:orders.length,in_transit:(orders as {status:string}[]).filter(order=>order.status==="shipped").length,addresses:addresses.length}});
  }catch(error){return apiError(error);}
}

const profileSchema=z.object({name:z.string().trim().min(2,"Informe seu nome").max(120),email:z.string().trim().toLowerCase().email("Informe um e-mail válido").max(160),phone:z.string().trim().max(20).optional().default(""),current_password:z.string().max(128).optional()});

export async function PATCH(request:Request){
  try{
    const user=await requireUser(),value=profileSchema.parse(await request.json()),db=getDb();
    const current=db.prepare("SELECT name,email,password_hash FROM customers WHERE id=?").get(user.id) as {name:string;email:string;password_hash:string|null}|undefined;
    if(!current)throw new Error("NOT_FOUND");
    db.prepare("UPDATE customers SET name=?,phone=? WHERE id=?").run(value.name,value.phone.replace(/\D/g,"")||null,user.id);
    if(value.email===current.email.toLowerCase())return ok({saved:true});
    // Changing the login e-mail is an account takeover vector: confirm the password and prove ownership of the new address.
    assertRateLimitFor("email-change",String(user.id),5,60*60_000);
    if(!current.password_hash||!value.current_password||!verifyPassword(value.current_password,current.password_hash))throw new Error("BAD_REQUEST:Informe sua senha atual para trocar o e-mail.");
    if(db.prepare("SELECT 1 FROM customers WHERE lower(email)=? AND id<>?").get(value.email,user.id))throw new Error("CONFLICT:Este e-mail já está em uso");
    const delivery=await sendEmailChangeConfirmation({id:user.id,name:value.name},value.email,appUrl(request));
    return ok({saved:true,email_change_pending:value.email,email_sent:delivery.sent});
  }
  catch(error){return apiError(error);}
}

export async function POST(request:Request){
  const db=getDb();
  try{const customerId=(await requireUser()).id;const body=await request.json();const required=["label","zip_code","street","number","district","city","state"] as const;for(const field of required)if(!String(body[field]||"").trim())throw new Error("VALIDATION:Preencha todos os campos obrigatórios do endereço");db.exec("BEGIN IMMEDIATE");if(body.is_default)db.prepare("UPDATE addresses SET is_default=0 WHERE customer_id=?").run(customerId);const result=db.prepare("INSERT INTO addresses(customer_id,label,zip_code,street,number,complement,district,city,state,is_default) VALUES(?,?,?,?,?,?,?,?,?,?)").run(customerId,String(body.label).trim(),String(body.zip_code).trim(),String(body.street).trim(),String(body.number).trim(),String(body.complement||"").trim()||null,String(body.district).trim(),String(body.city).trim(),String(body.state).trim().toUpperCase(),body.is_default?1:0);db.exec("COMMIT");return ok({id:Number(result.lastInsertRowid)});}
  catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}
}
