import { escapeHtml } from "@/lib/html";
import { getDb } from "@/lib/db";
import { apiError, ok, parseId } from "@/lib/api";
import { adminTransition } from "@/lib/order-state";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireAdminPermission } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) { try {const user=await requireUser();const {id}=await params; const db=getDb(); const order=db.prepare(`SELECT o.*,c.name AS customer,c.email,c.phone FROM orders o JOIN customers c ON c.id=o.customer_id WHERE (o.order_number=? OR o.id=?) AND o.customer_id=? ORDER BY o.order_number=? DESC LIMIT 1`).get(id,/^\d+$/.test(id)?Number(id):-1,user.id,id) as Record<string,unknown>|undefined; if(!order)throw new Error("NOT_FOUND"); const orderId=Number(order.id); return ok({...order,shipping_address:JSON.parse(String(order.shipping_address_json)),items:db.prepare("SELECT oi.*,pi.url AS image_url FROM order_items oi LEFT JOIN product_images pi ON pi.product_id=oi.product_id AND pi.position=0 WHERE oi.order_id=?").all(orderId),events:db.prepare("SELECT * FROM order_events WHERE order_id=? ORDER BY occurred_at").all(orderId)});}catch(error){return apiError(error);} }

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const admin=await requireAdminPermission("orders.manage");
    const {id}=await params; const orderId=parseId(id);
    const value=z.object({status:z.enum(["pending","paid","preparing","shipped","delivered","cancelled","refunded"]),tracking_code:z.string().trim().max(60).optional(),description:z.string().trim().max(500).optional()}).parse(await request.json());
    const db=getDb(),before=db.prepare("SELECT status FROM orders WHERE id=?").get(orderId) as {status:string}|undefined;
    const {changed}=adminTransition(db,orderId,value.status,{adminId:admin.id,description:value.description,trackingCode:value.tracking_code});
    audit(admin.id,"status_update","orders",orderId,{from:before?.status,to:value.status,tracking_code:value.tracking_code});
    const customer=db.prepare("SELECT o.order_number,c.name,c.email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=?").get(orderId) as {order_number:string;name:string;email:string};
    if(changed||value.tracking_code)await sendEmail({to:customer.email,subject:`Pedido #${customer.order_number}: status atualizado`,html:`<h2>Olá, ${escapeHtml(customer.name)}.</h2><p>O status do seu pedido agora é <strong>${value.status}</strong>.</p>${value.tracking_code?`<p>Código de rastreio: <strong>${escapeHtml(value.tracking_code)}</strong></p>`:""}`});
    return ok({id:orderId,status:value.status,changed});
  } catch(error){return apiError(error);}
}
