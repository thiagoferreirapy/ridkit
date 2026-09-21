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

export const runtime = "nodejs";

export async function GET(request:Request) {
  await requireAdminPermission("orders.view");
  try { const url=new URL(request.url); const {page,limit,offset}=pagination(url.searchParams); const where=["1=1"]; const params:(string|number)[]=[]; const customer=url.searchParams.get("customer_id"); const status=url.searchParams.get("status");
    if(customer){where.push("o.customer_id=?");params.push(Number(customer));} if(status){where.push("o.status=?");params.push(status);} const db=getDb(); const whereSql=where.join(" AND "); const total=Number((db.prepare(`SELECT COUNT(*) AS count FROM orders o WHERE ${whereSql}`).get(...params) as {count:number}).count);
    const items=db.prepare(`SELECT o.id,o.order_number,o.status,o.payment_method,o.payment_status,o.subtotal_cents,o.discount_cents,o.shipping_cents,o.shipping_rule_name,o.total_cents,o.shipping_method,o.tracking_code,o.created_at,c.name AS customer,c.email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params,limit,offset);
    return ok({items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(error){return apiError(error);}
}

export async function POST(request:Request) {
  const db=getDb();
  try { const settings=getStoreSettings();if(settings.purchase_mode!=="site")throw new Error("BAD_REQUEST:As compras estão sendo finalizadas pelo WhatsApp");const user=await requireUser(); const value=orderSchema.parse(await request.json());assertLegalAcceptance(value);const identity=validateCheckoutIdentity(value.checkout_identity);if(!identity.valid)throw new Error(`VALIDATION:Informe ${identity.missing.join(", ")}.`);
    if(value.idempotency_key){const existing=db.prepare("SELECT id,order_number,status,subtotal_cents,discount_cents,shipping_cents,total_cents FROM orders WHERE customer_id=? AND idempotency_key=?").get(user.id,value.idempotency_key);if(existing)return ok({...existing,idempotent:true});}
    db.exec("BEGIN IMMEDIATE");
    const customer=db.prepare("SELECT id,name,email FROM customers WHERE id=?").get(user.id) as {id:number;name:string;email:string}|undefined; if(!customer)throw new Error("BAD_REQUEST:Cliente inválido");
    let subtotal=0; const resolved=value.items.map(item=>{const variant=db.prepare(`SELECT v.id,v.sku,v.size,v.color,v.stock,v.reserved_stock,COALESCE(v.price_cents,p.price_cents) AS price_cents,p.id AS product_id,p.category_id,p.name FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.active=1`).get(item.variant_id) as {id:number;sku:string;size:string;color:string;stock:number;reserved_stock:number;price_cents:number;product_id:number;category_id:number;name:string}|undefined; if(!variant)throw new Error("BAD_REQUEST:Variação inválida"); if(variant.stock-variant.reserved_stock<item.quantity)throw new Error(`CONFLICT:Estoque insuficiente para ${variant.name}`); subtotal+=variant.price_cents*item.quantity; return {...item,...variant};});
    const method:ShippingMethod=value.shipping_method==="Expressa"?"express":value.shipping_method==="Retirada"?"pickup":"standard",quote=calculateShipping(subtotal,value.shipping_address,method),shipping=quote.shipping_cents;
    const couponItems:CouponItem[]=resolved.map(item=>({product_id:item.product_id,category_id:item.category_id,price_cents:item.price_cents,quantity:item.quantity}));
    const selected=value.coupon_code?requireOwnedApplicableCoupon(db,user.id,value.coupon_code,couponItems,shipping,settings.pix_discount_percent):bestCoupon(db,user.id,couponItems,shipping,settings.pix_discount_percent),couponId=selected?.coupon.id||null;
    const couponReduction=selected||{productCents:0,shippingCents:0,totalCents:0},pixDiscount=value.payment_method==="pix"&&settings.pix_discount_percent>0?Math.round((subtotal-couponReduction.productCents)*settings.pix_discount_percent/100):0;
    const discount=couponReduction.totalCents+pixDiscount,total=Math.max(0,subtotal+shipping-discount); const last=(db.prepare("SELECT COALESCE(MAX(id),0)+1 AS next FROM orders").get() as {next:number}).next; const orderNumber=`${10234+last}`;
    const orderResult=db.prepare(`INSERT INTO orders(customer_id,coupon_id,order_number,idempotency_key,status,payment_method,payment_status,subtotal_cents,discount_cents,shipping_cents,shipping_rule_id,shipping_rule_name,total_cents,shipping_method,shipping_address_json,checkout_contact_json) VALUES(?,?,?,?, 'pending',?,'pending',?,?,?,?,?,?,?,?,?)`).run(user.id,couponId,orderNumber,value.idempotency_key||null,value.payment_method,subtotal,discount,shipping,quote.rule?.id||null,quote.rule?.name||null,total,value.shipping_method,JSON.stringify(value.shipping_address),JSON.stringify(identity.normalized)); const orderId=Number(orderResult.lastInsertRowid);
    const itemStmt=db.prepare("INSERT INTO order_items(order_id,product_id,variant_id,product_name,variant_name,sku,unit_price_cents,quantity,total_cents) VALUES(?,?,?,?,?,?,?,?,?)"); const stockStmt=db.prepare("UPDATE product_variants SET reserved_stock=reserved_stock+? WHERE id=?");
    resolved.forEach(item=>{itemStmt.run(orderId,item.product_id,item.id,item.name,`${item.color} · ${item.size}`,item.sku,item.price_cents,item.quantity,item.price_cents*item.quantity);stockStmt.run(item.quantity,item.id);db.prepare("INSERT INTO inventory_movements(variant_id,order_id,movement_type,quantity,stock_after,reserved_after,reason) VALUES(?,?,'reservation',?,?,?,'Reserva criada no checkout')").run(item.id,orderId,item.quantity,item.stock,item.reserved_stock+item.quantity);});
    db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'pending','Pedido recebido',?)").run(orderId,quote.rule?`Frete grátis aplicado pela regra regional: ${quote.rule.name}.`:"Aguardando confirmação do pagamento.");recordLegalAcceptance(db,user.id,"checkout");recordOrderLegalAcceptance(db,orderId,user.id); if(couponId)db.prepare("UPDATE coupons SET used_count=used_count+1 WHERE id=?").run(couponId); db.exec("COMMIT"); await sendEmail({to:identity.normalized.email,subject:`Pedido #${orderNumber} recebido`,html:`<h2>Olá, ${customer.name}.</h2><p>Recebemos o pedido <strong>#${orderNumber}</strong>.</p>${quote.rule?`<p>Frete grátis: ${quote.rule.name}.</p>`:""}<p>Total: ${(total/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><p>Você pode acompanhar o andamento na sua conta Ridekit.</p>`}); return created({id:orderId,order_number:orderNumber,status:"pending",subtotal_cents:subtotal,discount_cents:discount,shipping_cents:shipping,shipping_rule:quote.rule,total_cents:total});
  } catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}
}
