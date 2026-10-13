import { z } from "zod";
import { apiError, ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/admin-auth";
import { getAsaasPayment } from "@/lib/asaas";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { applyPaymentOutcome,type PaymentOutcome } from "@/lib/order-state";

export const runtime="nodejs";
const outcomes:Record<string,PaymentOutcome>={RECEIVED:"approved",CONFIRMED:"approved",RECEIVED_IN_CASH:"approved",OVERDUE:"failed",REFUNDED:"refunded"};

export async function POST(request:Request){
  try{
    const admin=await requireAdminPermission("orders.manage");
    const {order_id}=z.object({order_id:z.coerce.number().int().positive()}).parse(await request.json());
    const db=getDb(),order=db.prepare("SELECT id,provider_payment_id FROM orders WHERE id=?").get(order_id) as {id:number;provider_payment_id:string|null}|undefined;
    if(!order)throw new Error("NOT_FOUND");
    if(!order.provider_payment_id)throw new Error("BAD_REQUEST:Pedido sem cobrança Asaas");
    const payment=await getAsaasPayment(order.provider_payment_id),outcome=outcomes[payment.status];
    // Chargebacks and pending refunds need a human decision; they are reported but not applied.
    const result=outcome?applyPaymentOutcome(db,order.id,outcome,{source:"reconcile",adminId:admin.id,paidValueCents:outcome==="approved"&&typeof payment.value==="number"?Math.round(payment.value*100):undefined}):{applied:false};
    db.prepare("INSERT INTO order_events(order_id,status,title,description) SELECT id,status,'Pagamento reconciliado',? FROM orders WHERE id=?").run(`Status consultado manualmente no Asaas: ${payment.status}.`,order.id);
    const current=db.prepare("SELECT status,payment_status,attention_reason FROM orders WHERE id=?").get(order.id) as {status:string;payment_status:string;attention_reason:string|null};
    audit(admin.id,"reconcile_payment","orders",order.id,{provider_status:payment.status,applied:result.applied});
    return ok({provider_status:payment.status,applied:result.applied,order_status:current.status,payment_status:current.payment_status,attention_reason:current.attention_reason});
  }catch(error){return apiError(error)}
}
