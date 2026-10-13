import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { applyPaymentOutcome,inTransaction,type PaymentOutcome } from "@/lib/order-state";

export const runtime="nodejs";

function authorized(received:string|null){const expected=process.env.ASAAS_WEBHOOK_TOKEN;if(!expected||!received)return false;const a=Buffer.from(received),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}

const outcomes:Record<string,PaymentOutcome>={PAYMENT_RECEIVED:"approved",PAYMENT_CONFIRMED:"approved",PAYMENT_OVERDUE:"failed",PAYMENT_DELETED:"failed",PAYMENT_REFUNDED:"refunded"};

export async function POST(request:Request){
  if(!authorized(request.headers.get("asaas-access-token")))return Response.json({error:"Não autorizado"},{status:401});
  let body:{id?:string;event?:string;payment?:{id?:string;externalReference?:string;value?:number}};
  try{body=await request.json();}catch{return Response.json({error:"Payload inválido"},{status:400});}
  if(!body.id||!body.event||!body.payment?.id)return Response.json({error:"Payload incompleto"},{status:400});
  const event=body.event,payment=body.payment,db=getDb();
  try{
    const result=inTransaction(db,()=>{
      // The event row is written in the same transaction as its effects, so a failed attempt is retried in full.
      const inserted=db.prepare("INSERT OR IGNORE INTO payment_webhook_events(id,provider,event,provider_payment_id,payload_json) VALUES(?,'asaas',?,?,?)").run(body.id!,event,payment.id!,JSON.stringify(body));
      if(!inserted.changes)return {duplicate:true};
      let order=db.prepare("SELECT id FROM orders WHERE provider_payment_id=?").get(payment.id!) as {id:number}|undefined;
      if(!order&&payment.externalReference?.startsWith("ridekit-order-")){const id=Number(payment.externalReference.slice(14));if(Number.isInteger(id))order=db.prepare("SELECT id FROM orders WHERE id=?").get(id) as {id:number}|undefined;}
      const outcome=outcomes[event];
      if(!order||!outcome)return {ignored:true};
      const paidValueCents=outcome==="approved"&&typeof payment.value==="number"?Math.round(payment.value*100):undefined;
      return applyPaymentOutcome(db,order.id,outcome,{source:"webhook",paidValueCents});
    });
    return Response.json({received:true,...result});
  }catch(error){logger.error("asaas.webhook.failed",error,{event,payment_id:payment.id});return Response.json({error:"Erro interno"},{status:500});}
}
