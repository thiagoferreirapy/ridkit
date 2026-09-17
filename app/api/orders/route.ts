import { getDb } from "@/lib/db";
import { apiError, created, ok, pagination } from "@/lib/api";
import { orderSchema } from "@/lib/schemas";
import { requireAdmin } from "@/lib/admin-auth";
import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { getStoreSettings } from "@/lib/store-settings";
import { calculateShipping, type ShippingMethod } from "@/lib/shipping";

export const runtime = "nodejs";

export async function GET(request:Request) {
  await requireAdmin();
  try { const url=new URL(request.url); const {page,limit,offset}=pagination(url.searchParams); const where=["1=1"]; const params:(string|number)[]=[]; const customer=url.searchParams.get("customer_id"); const status=url.searchParams.get("status");
    if(customer){where.push("o.customer_id=?");params.push(Number(customer));} if(status){where.push("o.status=?");params.push(status);} const db=getDb(); const whereSql=where.join(" AND "); const total=Number((db.prepare(`SELECT COUNT(*) AS count FROM orders o WHERE ${whereSql}`).get(...params) as {count:number}).count);
    const items=db.prepare(`SELECT o.id,o.order_number,o.status,o.payment_method,o.payment_status,o.subtotal_cents,o.discount_cents,o.shipping_cents,o.shipping_rule_name,o.total_cents,o.shipping_method,o.tracking_code,o.created_at,c.name AS customer,c.email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE ${whereSql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).all(...params,limit,offset);
    return ok({items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  } catch(error){return apiError(error);}
}

export async function POST(request:Request) {
  const db=getDb();
  try { const settings=getStoreSettings();if(settings.purchase_mode!=="site")throw new Error("BAD_REQUEST:As compras estão sendo finalizadas pelo WhatsApp");const user=await requireUser(); const value=orderSchema.parse(await request.json()); db.exec("BEGIN IMMEDIATE");
    const customer=db.prepare("SELECT id,name,email FROM customers WHERE id=?").get(user.id) as {id:number;name:string;email:string}|undefined; if(!customer)throw new Error("BAD_REQUEST:Cliente inválido");
    let subtotal=0; const resolved=value.items.map(item=>{const variant=db.prepare(`SELECT v.id,v.sku,v.size,v.color,v.stock,v.reserved_stock,COALESCE(v.price_cents,p.price_cents) AS price_cents,p.id AS product_id,p.name FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.active=1 AND p.active=1`).get(item.variant_id) as {id:number;sku:string;size:string;color:string;stock:number;reserved_stock:number;price_cents:number;product_id:number;name:string}|undefined; if(!variant)throw new Error("BAD_REQUEST:Variação inválida"); if(variant.stock-variant.reserved_stock<item.quantity)throw new Error(`CONFLICT:Estoque insuficiente para ${variant.name}`); subtotal+=variant.price_cents*item.quantity; return {...item,...variant};});
    let couponId:null|number=null,discount=0; if(value.coupon_code){const coupon=db.prepare("SELECT * FROM coupons WHERE code=? AND active=1 AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP) AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP)").get(value.coupon_code.toUpperCase()) as {id:number;discount_type:string;discount_value:number;min_order_cents:number;usage_limit:number|null;used_count:number}|undefined; if(!coupon||subtotal<coupon.min_order_cents||coupon.usage_limit!==null&&coupon.used_count>=coupon.usage_limit)throw new Error("BAD_REQUEST:Cupom inválido ou indisponível"); couponId=coupon.id; discount=coupon.discount_type==="percent"?Math.round(subtotal*coupon.discount_value/100):coupon.discount_type==="fixed"?Math.min(subtotal,coupon.discount_value):0;}
    const method:ShippingMethod=value.shipping_method==="Expressa"?"express":value.shipping_method==="Retirada"?"pickup":"standard",quote=calculateShipping(subtotal,value.shipping_address,method),shipping=quote.shipping_cents,total=subtotal-discount+shipping; const last=(db.prepare("SELECT COALESCE(MAX(id),0)+1 AS next FROM orders").get() as {next:number}).next; const orderNumber=`${10234+last}`;
    const orderResult=db.prepare(`INSERT INTO orders(customer_id,coupon_id,order_number,status,payment_method,payment_status,subtotal_cents,discount_cents,shipping_cents,shipping_rule_id,shipping_rule_name,total_cents,shipping_method,shipping_address_json) VALUES(?,?,?,'pending',?,'pending',?,?,?,?,?,?,?,?)`).run(user.id,couponId,orderNumber,value.payment_method,subtotal,discount,shipping,quote.rule?.id||null,quote.rule?.name||null,total,value.shipping_method,JSON.stringify(value.shipping_address)); const orderId=Number(orderResult.lastInsertRowid);
    const itemStmt=db.prepare("INSERT INTO order_items(order_id,product_id,variant_id,product_name,variant_name,sku,unit_price_cents,quantity,total_cents) VALUES(?,?,?,?,?,?,?,?,?)"); const stockStmt=db.prepare("UPDATE product_variants SET reserved_stock=reserved_stock+? WHERE id=?");
    resolved.forEach(item=>{itemStmt.run(orderId,item.product_id,item.id,item.name,`${item.color} · ${item.size}`,item.sku,item.price_cents,item.quantity,item.price_cents*item.quantity);stockStmt.run(item.quantity,item.id);});
    db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'pending','Pedido recebido',?)").run(orderId,quote.rule?`Frete grátis aplicado pela regra regional: ${quote.rule.name}.`:"Aguardando confirmação do pagamento."); if(couponId)db.prepare("UPDATE coupons SET used_count=used_count+1 WHERE id=?").run(couponId); db.exec("COMMIT"); await sendEmail({to:customer.email,subject:`Pedido #${orderNumber} recebido`,html:`<h2>Olá, ${customer.name}.</h2><p>Recebemos o pedido <strong>#${orderNumber}</strong>.</p>${quote.rule?`<p>Frete grátis: ${quote.rule.name}.</p>`:""}<p>Total: ${(total/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p><p>Você pode acompanhar o andamento na sua conta Ridekit.</p>`}); return created({id:orderId,order_number:orderNumber,status:"pending",subtotal_cents:subtotal,discount_cents:discount,shipping_cents:shipping,shipping_rule:quote.rule,total_cents:total});
  } catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}
}
