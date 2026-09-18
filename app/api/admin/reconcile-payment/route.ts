import { z } from "zod";
import { apiError, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/admin-auth";
import { getAsaasPayment } from "@/lib/asaas";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";

export const runtime="nodejs";
const paid=new Set(["RECEIVED","CONFIRMED","RECEIVED_IN_CASH"]);
const failed=new Set(["OVERDUE","REFUNDED","REFUND_REQUESTED","CHARGEBACK_REQUESTED","CHARGEBACK_DISPUTE","AWAITING_CHARGEBACK_REVERSAL"]);

export async function POST(request:Request){
  try{
    const admin=await requireAdminPermission("orders.manage");
    const {order_id}=z.object({order_id:z.coerce.number().int().positive()}).parse(await request.json());
    const db=getDb(),order=db.prepare("SELECT id,status,payment_status,provider_payment_id FROM orders WHERE id=?").get(order_id) as {id:number;status:string;payment_status:string;provider_payment_id:string|null}|undefined;
    if(!order)throw new Error("NOT_FOUND");
    if(!order.provider_payment_id)throw new Error("BAD_REQUEST:Pedido sem cobrança Asaas");
    const payment=await getAsaasPayment(order.provider_payment_id);
    const paymentStatus=paid.has(payment.status)?"approved":failed.has(payment.status)?"failed":"pending";
    const orderStatus=paymentStatus==="approved"&&order.status==="pending"?"paid":paymentStatus==="failed"&&order.status==="pending"?"cancelled":order.status;
    db.prepare("UPDATE orders SET payment_status=?,status=?,payment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(paymentStatus,orderStatus,order.id);
    db.prepare("INSERT INTO payment_attempts(order_id,provider,status,provider_id,error) VALUES(?,'asaas',?,?,NULL)").run(order.id,`reconciled:${payment.status}`,payment.id);
    db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,?,?,?)").run(order.id,orderStatus,"Pagamento reconciliado",`Status consultado manualmente no Asaas: ${payment.status}.`);
    audit(admin.id,"reconcile_payment","orders",order.id,{provider_status:payment.status,payment_status:paymentStatus});
    return ok({provider_status:payment.status,payment_status:paymentStatus,order_status:orderStatus});
  }catch(error){return apiError(error)}
}
