import test from "node:test";
import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { adminTransition,applyPaymentOutcome,expireReservations } from "../lib/order-state.ts";
import { orderSchema } from "../lib/schemas.ts";
import { insertCustomer,insertVariant,testDb } from "./helpers/db.ts";

let orderSeq=0;
// Mirrors POST /api/orders: pending order whose units are reserved on the variant.
function pendingOrder(db:DatabaseSync,variantId:number,quantity:number,options:{couponId?:number;expiresInMinutes?:number;totalCents?:number}={}){
  orderSeq+=1;
  const total=options.totalCents??quantity*10000;
  const order=db.prepare("INSERT INTO orders(customer_id,coupon_id,order_number,status,payment_method,payment_status,subtotal_cents,total_cents,shipping_method,shipping_address_json,reservation_expires_at) VALUES(1,?,?,'pending','pix','pending',?,?,'Econômica','{}',datetime('now',?))").run(options.couponId??null,`T-${orderSeq}`,total,total,`${options.expiresInMinutes??30} minutes`);
  const orderId=Number(order.lastInsertRowid);
  db.prepare("INSERT INTO order_items(order_id,product_id,variant_id,product_name,variant_name,sku,unit_price_cents,quantity,total_cents) SELECT ?,product_id,id,'Produto','M','SKU',10000,?,? FROM product_variants WHERE id=?").run(orderId,quantity,quantity*10000,variantId);
  db.prepare("UPDATE product_variants SET reserved_stock=reserved_stock+? WHERE id=?").run(quantity,variantId);
  if(options.couponId)db.prepare("UPDATE coupons SET used_count=used_count+1 WHERE id=?").run(options.couponId);
  return orderId;
}
const stock=(db:DatabaseSync,variantId:number)=>({...db.prepare("SELECT stock,reserved_stock AS reserved FROM product_variants WHERE id=?").get(variantId) as {stock:number;reserved:number}});
const order=(db:DatabaseSync,orderId:number)=>db.prepare("SELECT status,payment_status,attention_reason FROM orders WHERE id=?").get(orderId) as {status:string;payment_status:string;attention_reason:string|null};
function setup(stockUnits=5){const db=testDb();insertCustomer(db,1);db.prepare("INSERT INTO admin_users(id,name,email,password_hash) VALUES(1,'Admin','admin@example.com','x')").run();const {variantId}=insertVariant(db,{stock:stockUnits});return {db,variantId};}

test("pagamento aprovado vende a reserva uma única vez",()=>{
  const {db,variantId}=setup(5),id=pendingOrder(db,variantId,2);
  assert.deepEqual(stock(db,variantId),{stock:5,reserved:2});
  assert.equal(applyPaymentOutcome(db,id,"approved",{source:"webhook",paidValueCents:20000}).applied,true);
  assert.deepEqual(stock(db,variantId),{stock:3,reserved:0});
  assert.equal(applyPaymentOutcome(db,id,"approved",{source:"webhook",paidValueCents:20000}).applied,false);
  assert.deepEqual(stock(db,variantId),{stock:3,reserved:0});
  assert.equal(order(db,id).status,"paid");
});

test("pagamento após a reserva expirar não rouba a reserva de outro cliente",()=>{
  const {db,variantId}=setup(3),a=pendingOrder(db,variantId,3,{expiresInMinutes:-1});
  assert.equal(expireReservations(db),1);
  assert.deepEqual(stock(db,variantId),{stock:3,reserved:0});
  const b=pendingOrder(db,variantId,3);
  const late=applyPaymentOutcome(db,a,"approved",{source:"webhook",paidValueCents:30000});
  assert.equal(late.applied,false);
  assert.equal(late.attention,true);
  assert.equal(order(db,a).payment_status,"approved");
  assert.match(order(db,a).attention_reason||"",/Estorne/);
  assert.deepEqual(stock(db,variantId),{stock:3,reserved:3},"reserva de B intacta");
  assert.equal(applyPaymentOutcome(db,b,"approved",{source:"webhook",paidValueCents:30000}).applied,true);
  assert.deepEqual(stock(db,variantId),{stock:0,reserved:0});
});

test("pagamento após expirar é aceito quando ainda há estoque livre",()=>{
  const {db,variantId}=setup(5),a=pendingOrder(db,variantId,2,{expiresInMinutes:-1});
  expireReservations(db);
  assert.equal(applyPaymentOutcome(db,a,"approved",{source:"webhook",paidValueCents:20000}).applied,true);
  assert.equal(order(db,a).status,"paid");
  assert.deepEqual(stock(db,variantId),{stock:3,reserved:0});
});

test("expiração ignora pedido pago e pedido ainda no prazo",()=>{
  const {db,variantId}=setup(10),paid=pendingOrder(db,variantId,1,{expiresInMinutes:-5}),open=pendingOrder(db,variantId,1,{expiresInMinutes:30});
  applyPaymentOutcome(db,paid,"approved",{source:"webhook"});
  assert.equal(expireReservations(db),0);
  assert.equal(order(db,paid).status,"paid");
  assert.equal(order(db,open).status,"pending");
  assert.deepEqual(stock(db,variantId),{stock:9,reserved:1});
});

test("valor divergente não confirma o pedido",()=>{
  const {db,variantId}=setup(5),id=pendingOrder(db,variantId,1,{totalCents:10000});
  const result=applyPaymentOutcome(db,id,"approved",{source:"webhook",paidValueCents:100});
  assert.equal(result.applied,false);
  assert.equal(order(db,id).status,"pending");
  assert.match(order(db,id).attention_reason||"",/diferente do total/);
  assert.deepEqual(stock(db,variantId),{stock:5,reserved:1});
});

test("estorno devolve estoque antes do envio e evento RECEIVED atrasado é ignorado",()=>{
  const {db,variantId}=setup(5),id=pendingOrder(db,variantId,2);
  applyPaymentOutcome(db,id,"approved",{source:"webhook"});
  applyPaymentOutcome(db,id,"refunded",{source:"webhook"});
  assert.equal(order(db,id).status,"refunded");
  assert.deepEqual(stock(db,variantId),{stock:5,reserved:0});
  assert.equal(applyPaymentOutcome(db,id,"approved",{source:"webhook"}).applied,false);
  assert.deepEqual(stock(db,variantId),{stock:5,reserved:0});
});

test("estorno de pedido enviado não devolve estoque automaticamente",()=>{
  const {db,variantId}=setup(5),id=pendingOrder(db,variantId,2);
  applyPaymentOutcome(db,id,"approved",{source:"webhook"});
  adminTransition(db,id,"shipped",{adminId:1,trackingCode:"BR1"});
  adminTransition(db,id,"refunded",{adminId:1});
  assert.deepEqual(stock(db,variantId),{stock:3,reserved:0});
  const note=db.prepare("SELECT description FROM order_events WHERE order_id=? AND status='refunded'").get(id) as {description:string};
  assert.match(note.description,/devolução física/);
});

test("admin não pula etapas e cancelamento libera reserva e cupom",()=>{
  const {db,variantId}=setup(5);
  const coupon=Number(db.prepare("INSERT INTO coupons(code,discount_type,discount_value) VALUES('X','percent',10)").run().lastInsertRowid);
  const id=pendingOrder(db,variantId,2,{couponId:coupon});
  assert.throws(()=>adminTransition(db,id,"delivered",{adminId:1}),/CONFLICT/);
  adminTransition(db,id,"cancelled",{adminId:1});
  assert.deepEqual(stock(db,variantId),{stock:5,reserved:0});
  assert.equal((db.prepare("SELECT used_count FROM coupons WHERE id=?").get(coupon) as {used_count:number}).used_count,0);
  assert.throws(()=>adminTransition(db,id,"paid",{adminId:1}),/CONFLICT/);
  assert.equal(order(db,id).payment_status,"failed");
});

test("aprovação com estoque inconsistente marca atenção em vez de falhar o webhook",()=>{
  const {db,variantId}=setup(5),id=pendingOrder(db,variantId,2);
  db.prepare("UPDATE product_variants SET stock=1 WHERE id=?").run(variantId);
  const result=applyPaymentOutcome(db,id,"approved",{source:"webhook"});
  assert.equal(result.attention,true);
  assert.equal(order(db,id).payment_status,"approved");
  assert.equal(stock(db,variantId).stock,1);
});

test("itens repetidos no pedido são somados antes da validação",()=>{
  const base={legal_version:"x",accept_terms:true,acknowledge_privacy:true,checkout_identity:{email:"a@b.co",cpf:"12345678909",phone:"11987654321"},payment_method:"pix",shipping_method:"Econômica",shipping_address:{zip_code:"01001000",street:"Rua",number:"1",district:"Centro",city:"SP",state:"SP"}};
  const merged=orderSchema.parse({...base,items:[{variant_id:7,quantity:3},{variant_id:7,quantity:4},{variant_id:8,quantity:1}]});
  assert.deepEqual(merged.items,[{variant_id:7,quantity:7},{variant_id:8,quantity:1}]);
  assert.equal(orderSchema.safeParse({...base,items:[{variant_id:7,quantity:6},{variant_id:7,quantity:6}]}).success,false);
  assert.equal(orderSchema.safeParse({...base,items:Array.from({length:21},(_,index)=>({variant_id:index+1,quantity:1}))}).success,false);
});

test("pagamento correto depois de um aviso limpa a pendência do pedido",()=>{
  const {db,variantId}=setup(5),id=pendingOrder(db,variantId,1,{totalCents:10000});
  applyPaymentOutcome(db,id,"approved",{source:"webhook",paidValueCents:1});
  assert.ok(order(db,id).attention_reason);
  applyPaymentOutcome(db,id,"approved",{source:"webhook",paidValueCents:10000});
  assert.equal(order(db,id).status,"paid");
  assert.equal(order(db,id).attention_reason,null);
});
