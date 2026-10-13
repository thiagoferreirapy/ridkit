import { escapeHtml } from "@/lib/html";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { apiError, created, ok, pagination } from "@/lib/api";
import { orderSchema } from "@/lib/schemas";
import { requireAdminPermission } from "@/lib/admin-auth";
import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getStoreSettings } from "@/lib/store-settings";
import { calculateShipping, type ShippingMethod } from "@/lib/shipping";
import { assertLegalAcceptance,recordLegalAcceptance,recordOrderLegalAcceptance } from "@/lib/legal-acceptance";
import { validateCheckoutIdentity } from "@/lib/checkout-calculations";
import { bestCoupon,requireOwnedApplicableCoupon,type CouponItem } from "@/lib/coupons";
import { sqliteUtc } from "@/lib/order-state";
import { assertRateLimitFor } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Unpaid orders hold stock; these bound how long and how much a single account can hold.
const PENDING_RESERVATION_MINUTES=30,MAX_OPEN_ORDERS=3;

export async function GET(request:Request) {
  try { await requireAdminPermission("orders.view"); const url=new URL(request.url); const {page,limit,offset}=pagination(url.searchParams); const where=["1=1"]; const params:(string|number)[]=[]; const customer=url.searchParams.get("customer_id"); const status=url.searchParams.get("status");
    if(customer){where.push("o.customer_id=?");params.push(Number(customer));} if(status){where.push("o.status=?");params.push(status);} const db=getDb(); const whereSql=where.join(" AND "); const total=Number((db.prepare(`SELECT COUNT(*) AS count FROM orders o WHERE ${whereSql}`).get(...params) as {count:number}).count);
    const items=db.prepare(`SELECT o.id,o.order_number,o.status,o.payment_method,o.payment_status,o.subtotal_cents,o.discount_cents,o.shipping_cents,o.shipping_rule_name,o.total_cents,o.shipping_method,o.tracking_code,o.attention_reason,o.reservation_expires_at,o.created_at,c.name AS customer,c.email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params,limit,offset);
    return ok({items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(error){return apiError(error);}
}

// Hash of everything that defines the order, so a reused idempotency key with a different cart is rejected.
function orderFingerprint(value:z.infer<typeof orderSchema>){
  const items=[...value.items].sort((a,b)=>a.variant_id-b.variant_id);
  return createHash("sha256").update(JSON.stringify({items,address:value.shipping_address,shipping:value.shipping_method,coupon:value.coupon_code||null,payment:value.payment_method,identity:value.checkout_identity})).digest("hex");
}

export async function POST(request:Request) {
  const db=getDb();
  try { const settings=getStoreSettings();if(settings.purchase_mode!=="site")throw new Error("BAD_REQUEST:As compras estão sendo finalizadas pelo WhatsApp");const user=await requireUser();assertRateLimitFor("create-order",String(user.id),10,10*60_000); const value=orderSchema.parse(await request.json());assertLegalAcceptance(value);const identity=validateCheckoutIdentity(value.checkout_identity);if(!identity.valid)throw new Error(`VALIDATION:Informe ${identity.missing.join(", ")}.`);
    const fingerprint=orderFingerprint(value);
    db.exec("BEGIN IMMEDIATE");
    if(value.idempotency_key){const existing=db.prepare("SELECT id,order_number,status,payment_status,idempotency_hash,subtotal_cents,discount_cents,shipping_cents,total_cents FROM orders WHERE customer_id=? AND idempotency_key=?").get(user.id,value.idempotency_key) as {id:number;order_number:string;status:string;payment_status:string;idempotency_hash:string|null;subtotal_cents:number;discount_cents:number;shipping_cents:number;total_cents:number}|undefined;
      if(existing&&existing.status==="pending"&&existing.payment_status==="pending"){
        if(existing.idempotency_hash&&existing.idempotency_hash!==fingerprint)throw new Error("CONFLICT:O carrinho mudou desde a última tentativa. Atualize a página e confirme o pedido novamente.");
        db.exec("COMMIT");const {idempotency_hash:_hash,payment_status:_payment,...replay}=existing;return ok({...replay,idempotent:true});
      }
      // The key belongs to an order that is already closed (paid, expired, cancelled): free it for this new order.
      if(existing)db.prepare("UPDATE orders SET idempotency_key=NULL WHERE id=?").run(existing.id);
    }
    const openOrders=(db.prepare("SELECT COUNT(*) AS count FROM orders WHERE customer_id=? AND status='pending' AND payment_status='pending'").get(user.id) as {count:number}).count;
    if(openOrders>=MAX_OPEN_ORDERS)throw new Error("CONFLICT:Você já tem pedidos aguardando pagamento. Conclua ou aguarde a expiração deles antes de criar outro.");
    const customer=db.prepare("SELECT id,name,email FROM customers WHERE id=?").get(user.id) as {id:number;name:string;email:string}|undefined; if(!customer)throw new Error("BAD_REQUEST:Cliente inválido");
    let subtotal=0; const resolved=value.items.map(item=>{const variant=db.prepare(`SELECT v.id,v.sku,v.size,v.color,v.stock,v.reserved_stock,COALESCE(v.price_cents,p.price_cents) AS price_cents,p.id AS product_id,p.category_id,p.name FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.active=1 AND p.publication_status='active'`).get(item.variant_id) as {id:number;sku:string;size:string;color:string;stock:number;reserved_stock:number;price_cents:number;product_id:number;category_id:number;name:string}|undefined; if(!variant)throw new Error("BAD_REQUEST:Variação inválida"); if(variant.stock-variant.reserved_stock<item.quantity)throw new Error(`CONFLICT:Estoque insuficiente para ${variant.name}`); subtotal+=variant.price_cents*item.quantity; return {...item,...variant};});
    const method:ShippingMethod=value.shipping_method==="Expressa"?"express":value.shipping_method==="Retirada"?"pickup":"standard",quote=calculateShipping(subtotal,value.shipping_address,method),shipping=quote.shipping_cents;
    const couponItems:CouponItem[]=resolved.map(item=>({product_id:item.product_id,category_id:item.category_id,price_cents:item.price_cents,quantity:item.quantity}));
    const selected=value.coupon_code?requireOwnedApplicableCoupon(db,user.id,value.coupon_code,couponItems,shipping,settings.pix_discount_percent):bestCoupon(db,user.id,couponItems,shipping,settings.pix_discount_percent),couponId=selected?.coupon.id||null;
    const couponReduction=selected||{productCents:0,shippingCents:0,totalCents:0},pixDiscount=value.payment_method==="pix"&&settings.pix_discount_percent>0?Math.round((subtotal-couponReduction.productCents)*settings.pix_discount_percent/100):0;
    const discount=couponReduction.totalCents+pixDiscount,total=Math.max(0,subtotal+shipping-discount); const last=(db.prepare("SELECT COALESCE(MAX(id),0)+1 AS next FROM orders").get() as {next:number}).next; const orderNumber=`${10234+last}`;
    const reservationExpiresAt=sqliteUtc(new Date(Date.now()+PENDING_RESERVATION_MINUTES*60_000));
    const orderResult=db.prepare(`INSERT INTO orders(customer_id,coupon_id,order_number,idempotency_key,idempotency_hash,status,payment_method,payment_status,subtotal_cents,discount_cents,shipping_cents,shipping_rule_id,shipping_rule_name,total_cents,shipping_method,shipping_address_json,checkout_contact_json,reservation_expires_at) VALUES(?,?,?,?,?, 'pending',?,'pending',?,?,?,?,?,?,?,?,?,?)`).run(user.id,couponId,orderNumber,value.idempotency_key||null,fingerprint,value.payment_method,subtotal,discount,shipping,quote.rule?.id||null,quote.rule?.name||null,total,value.shipping_method,JSON.stringify(value.shipping_address),JSON.stringify(identity.normalized),reservationExpiresAt); const orderId=Number(orderResult.lastInsertRowid);
    const itemStmt=db.prepare("INSERT INTO order_items(order_id,product_id,variant_id,product_name,variant_name,sku,unit_price_cents,quantity,total_cents) VALUES(?,?,?,?,?,?,?,?,?)"); const stockStmt=db.prepare("UPDATE product_variants SET reserved_stock=reserved_stock+? WHERE id=?");
    resolved.forEach(item=>{itemStmt.run(orderId,item.product_id,item.id,item.name,`${item.color} · ${item.size}`,item.sku,item.price_cents,item.quantity,item.price_cents*item.quantity);stockStmt.run(item.quantity,item.id);db.prepare("INSERT INTO inventory_movements(variant_id,order_id,movement_type,quantity,stock_after,reserved_after,reason) VALUES(?,?,'reservation',?,?,?,'Reserva criada no checkout')").run(item.id,orderId,item.quantity,item.stock,item.reserved_stock+item.quantity);});
    db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'pending','Pedido recebido',?)").run(orderId,quote.rule?`Frete grátis aplicado pela regra regional: ${quote.rule.name}.`:"Aguardando confirmação do pagamento.");recordLegalAcceptance(db,user.id,"checkout");recordOrderLegalAcceptance(db,orderId,user.id); if(couponId)db.prepare("UPDATE coupons SET used_count=used_count+1 WHERE id=?").run(couponId); db.exec("COMMIT"); await sendEmail({to:identity.normalized.email,subject:`Pedido #${orderNumber} recebido`,html:`<h2>Olá, ${escapeHtml(customer.name)}.</h2><p>Recebemos o pedido <strong>#${orderNumber}</strong>.</p>${quote.rule?`<p>Frete grátis: ${escapeHtml(quote.rule.name)}.</p>`:""}<p>Total: ${(total/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><p>Você pode acompanhar o andamento na sua conta Ridekit.</p>`}); return created({id:orderId,order_number:orderNumber,status:"pending",subtotal_cents:subtotal,discount_cents:discount,shipping_cents:shipping,shipping_rule:quote.rule,total_cents:total,reservation_expires_at:reservationExpiresAt});
  } catch(error){if(db.isTransaction)db.exec("ROLLBACK");if(error instanceof Error&&/UNIQUE constraint failed: orders\.customer_id, orders\.idempotency_key/.test(error.message))return apiError(new Error("CONFLICT:Este pedido já está sendo processado. Aguarde um instante."));return apiError(error);}
}
