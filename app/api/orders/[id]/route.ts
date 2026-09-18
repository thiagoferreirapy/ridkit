import { getDb } from "@/lib/db";
import { apiError, ok } from "@/lib/api";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireAdminPermission } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) { try {const user=await requireUser();const {id}=await params; const db=getDb(); const order=db.prepare(`SELECT o.*,c.name AS customer,c.email,c.phone FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ${/^\d+$/.test(id)?"o.id":"o.order_number"}=? AND o.customer_id=?`).get(/^\d+$/.test(id)?Number(id):id,user.id) as Record<string,unknown>|undefined; if(!order)throw new Error("NOT_FOUND"); const orderId=Number(order.id); return ok({...order,shipping_address:JSON.parse(String(order.shipping_address_json)),items:db.prepare("SELECT oi.*,pi.url AS image_url FROM order_items oi LEFT JOIN product_images pi ON pi.product_id=oi.product_id AND pi.position=0 WHERE oi.order_id=?").all(orderId),events:db.prepare("SELECT * FROM order_events WHERE order_id=? ORDER BY occurred_at").all(orderId)});}catch(error){return apiError(error);} }

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  const admin=await requireAdminPermission("orders.manage");
  const db=getDb();
  try {
    const {id}=await params; const orderId=Number(id);
    const value=z.object({status:z.enum(["pending","paid","preparing","shipped","delivered","cancelled","refunded"]),payment_status:z.enum(["pending","approved","failed","refunded"]).optional(),tracking_code:z.string().optional(),description:z.string().optional()}).parse(await request.json());
    const order=db.prepare("SELECT o.status,o.order_number,c.name,c.email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=?").get(orderId) as {status:string;order_number:string;name:string;email:string}|undefined; if(!order)throw new Error("NOT_FOUND");
    const committed=["paid","preparing","shipped","delivered"]; const wasCommitted=committed.includes(order.status); const willCommit=committed.includes(value.status); const willCancel=["cancelled","refunded"].includes(value.status);
    db.exec("BEGIN IMMEDIATE");
    db.prepare("UPDATE orders SET status=?,payment_status=COALESCE(?,payment_status),tracking_code=COALESCE(?,tracking_code),updated_at=CURRENT_TIMESTAMP WHERE id=?").run(value.status,value.payment_status??null,value.tracking_code??null,orderId);
    db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,?,?,?)").run(orderId,value.status,`Status atualizado: ${value.status}`,value.description??null);
    if(!wasCommitted&&willCommit) db.prepare("UPDATE product_variants SET stock=MAX(0,stock-(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=? AND variant_id=product_variants.id)),reserved_stock=MAX(0,reserved_stock-(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=? AND variant_id=product_variants.id)) WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=?)").run(orderId,orderId,orderId);
    if(willCancel&&!wasCommitted) db.prepare("UPDATE product_variants SET reserved_stock=MAX(0,reserved_stock-(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=? AND variant_id=product_variants.id)) WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=?)").run(orderId,orderId);
    if(willCancel&&wasCommitted) db.prepare("UPDATE product_variants SET stock=stock+(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=? AND variant_id=product_variants.id) WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=?)").run(orderId,orderId);
    db.exec("COMMIT"); audit(admin.id,"status_update","orders",orderId,{from:order.status,to:value.status});await sendEmail({to:order.email,subject:`Pedido #${order.order_number}: status atualizado`,html:`<h2>Olá, ${order.name}.</h2><p>O status do seu pedido agora é <strong>${value.status}</strong>.</p>${value.tracking_code?`<p>Código de rastreio: <strong>${value.tracking_code}</strong></p>`:""}`}); return ok({id:orderId,status:value.status});
  } catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}
}
