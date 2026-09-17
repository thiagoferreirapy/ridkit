import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";

export const runtime="nodejs";

function authorized(received:string|null){const expected=process.env.ASAAS_WEBHOOK_TOKEN;if(!expected||!received)return false;const a=Buffer.from(received),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}

export async function POST(request:Request){
  if(!authorized(request.headers.get("asaas-access-token")))return Response.json({error:"Não autorizado"},{status:401});
  let body:{id?:string;event?:string;payment?:{id?:string;externalReference?:string}};
  try{body=await request.json();}catch{return Response.json({error:"Payload inválido"},{status:400});}
  if(!body.id||!body.event||!body.payment?.id)return Response.json({error:"Payload incompleto"},{status:400});
  const db=getDb();db.exec("BEGIN IMMEDIATE");
  try{
    const inserted=db.prepare("INSERT OR IGNORE INTO payment_webhook_events(id,provider,event,provider_payment_id,payload_json) VALUES(?,'asaas',?,?,?)").run(body.id,body.event,body.payment.id,JSON.stringify(body));
    if(!inserted.changes){db.exec("COMMIT");return Response.json({received:true,duplicate:true});}
    let order=db.prepare("SELECT id,status,payment_status,coupon_id FROM orders WHERE provider_payment_id=?").get(body.payment.id) as {id:number;status:string;payment_status:string;coupon_id:number|null}|undefined;
    if(!order&&body.payment.externalReference?.startsWith("ridekit-order-")){const id=Number(body.payment.externalReference.slice(14));if(Number.isInteger(id))order=db.prepare("SELECT id,status,payment_status,coupon_id FROM orders WHERE id=?").get(id) as typeof order;}
    if(order){
      if(["PAYMENT_RECEIVED","PAYMENT_CONFIRMED"].includes(body.event)&&order.payment_status!=="approved"){
        const items=db.prepare("SELECT variant_id,quantity FROM order_items WHERE order_id=?").all(order.id) as {variant_id:number;quantity:number}[];
        db.prepare("UPDATE product_variants SET stock=stock-(SELECT quantity FROM order_items WHERE order_id=? AND variant_id=product_variants.id),reserved_stock=MAX(0,reserved_stock-(SELECT quantity FROM order_items WHERE order_id=? AND variant_id=product_variants.id)) WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=?)").run(order.id,order.id,order.id);
        for(const item of items){const state=db.prepare("SELECT stock,reserved_stock FROM product_variants WHERE id=?").get(item.variant_id) as {stock:number;reserved_stock:number};db.prepare("INSERT INTO inventory_movements(variant_id,order_id,movement_type,quantity,stock_after,reserved_after,reason) VALUES(?,?,'sale',?,?,?,?)").run(item.variant_id,order.id,-item.quantity,state.stock,state.reserved_stock,"Pagamento confirmado pelo Asaas");}
        db.prepare("UPDATE orders SET status='paid',payment_status='approved',payment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
        db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'paid','Pagamento Pix aprovado','Pagamento confirmado automaticamente pelo Asaas.')").run(order.id);
      }else if(["PAYMENT_OVERDUE","PAYMENT_DELETED"].includes(body.event)&&order.payment_status==="pending"){
        const items=db.prepare("SELECT variant_id,quantity FROM order_items WHERE order_id=?").all(order.id) as {variant_id:number;quantity:number}[];
        db.prepare("UPDATE product_variants SET reserved_stock=MAX(0,reserved_stock-(SELECT quantity FROM order_items WHERE order_id=? AND variant_id=product_variants.id)) WHERE id IN (SELECT variant_id FROM order_items WHERE order_id=?)").run(order.id,order.id);
        for(const item of items){const state=db.prepare("SELECT stock,reserved_stock FROM product_variants WHERE id=?").get(item.variant_id) as {stock:number;reserved_stock:number};db.prepare("INSERT INTO inventory_movements(variant_id,order_id,movement_type,quantity,stock_after,reserved_after,reason) VALUES(?,?,'release',?,?,?,?)").run(item.variant_id,order.id,-item.quantity,state.stock,state.reserved_stock,"Reserva liberada após expiração do pagamento");}
        db.prepare("UPDATE orders SET status='cancelled',payment_status='failed',payment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
        if(order.coupon_id)db.prepare("UPDATE coupons SET used_count=MAX(0,used_count-1) WHERE id=?").run(order.coupon_id);
        db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'cancelled','Pagamento Pix não concluído','A cobrança Pix expirou ou foi removida.')").run(order.id);
      }else if(body.event==="PAYMENT_REFUNDED"&&order.payment_status!=="refunded"){
        db.prepare("UPDATE orders SET status='refunded',payment_status='refunded',payment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
        db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'refunded','Pagamento estornado','O Asaas informou o estorno do pagamento.')").run(order.id);
      }
    }
    db.exec("COMMIT");return Response.json({received:true});
  }catch(error){if(db.isTransaction)db.exec("ROLLBACK");console.error("Asaas webhook error",error);return Response.json({error:"Erro interno"},{status:500});}
}
