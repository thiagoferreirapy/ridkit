import test from "node:test";
import assert from "node:assert/strict";
import { activeCustomerCoupons,bestCoupon,couponDiscount,evaluateCoupon,redeemCoupon,requireOwnedApplicableCoupon,type CouponItem } from "../lib/coupons.ts";
import { insertCustomer,testDb } from "./helpers/db.ts";

const couponColumns="(id,code,description,discount_type,discount_value,min_order_cents,scope_type,scope_value,usage_limit,used_count,starts_at,ends_at,active)";
function fixture(){
  const db=testDb();insertCustomer(db,1);insertCustomer(db,2);
  db.exec("INSERT INTO brands(id,name,slug) VALUES(1,'Marca','marca');INSERT INTO categories(id,parent_id,slug,name) VALUES(1,NULL,'equipamentos','Equipamentos'),(2,1,'luvas','Luvas'),(3,NULL,'capacetes','Capacetes');INSERT INTO products(id,brand_id,category_id,slug,name,sku,description,price_cents,color) VALUES(10,1,2,'luva-teste','Luva','L1','Luva',10000,'Preto'),(20,1,3,'capacete-teste','Capacete','C1','Capacete',50000,'Preto')");
  db.exec(`INSERT INTO coupons${couponColumns} VALUES(1,'LUVA50',NULL,'percent',50,0,'category','luvas',NULL,0,NULL,NULL,1),(2,'LOJA20',NULL,'percent',20,0,'all',NULL,NULL,0,NULL,NULL,1),(3,'LUVA100',NULL,'fixed',10000,15000,'category','luvas',NULL,0,NULL,NULL,1),(4,'OUTRO',NULL,'fixed',5000,0,'all',NULL,NULL,0,NULL,NULL,1)`);
  const items:CouponItem[]=[{product_id:10,category_id:2,price_cents:10000,quantity:1},{product_id:20,category_id:3,price_cents:50000,quantity:1}];
  return {db,items};
}

test("cupom de luvas não desconta capacete no carrinho misto",()=>{
  const {db,items}=fixture();
  const luvas=redeemCoupon(db,1,"LUVA50"),all=redeemCoupon(db,1,"LOJA20");
  assert.equal(evaluateCoupon(db,luvas,items,1990).productCents,5000);
  assert.equal(bestCoupon(db,1,items,1990)?.coupon.id,all.id);
  assert.equal(bestCoupon(db,1,[items[0]],1990)?.coupon.id,luvas.id);
  db.close();
});

test("mínimo considera só itens elegíveis e categoria ancestral cobre subcategoria",()=>{
  const {db,items}=fixture();
  const coupon=redeemCoupon(db,1,"LUVA100");
  assert.equal(evaluateCoupon(db,coupon,items,1990).missingCents,5000);
  assert.throws(()=>requireOwnedApplicableCoupon(db,1,"LUVA100",items,1990),/produtos elegíveis/);
  db.prepare("UPDATE coupons SET scope_value='equipamentos',min_order_cents=0 WHERE id=3").run();
  assert.equal(evaluateCoupon(db,{...coupon,scope_value:"equipamentos",min_order_cents:0},items,1990).eligibleSubtotalCents,10000);
  db.close();
});

test("apenas cupons resgatados pela própria conta podem ser usados",()=>{
  const {db,items}=fixture();
  redeemCoupon(db,1,"LUVA50");
  assert.deepEqual(activeCustomerCoupons(db,2),[]);
  assert.equal(bestCoupon(db,2,items,1990),null);
  assert.throws(()=>requireOwnedApplicableCoupon(db,2,"LUVA50",items,1990),/não está disponível na sua conta/);
  db.close();
});

test("desconto Pix incide sobre produtos após cupom, sem duplicidade",()=>{
  const coupon=couponDiscount({discount_type:"percent",discount_value:10},10000,1990);
  const pix=Math.round((10000-coupon.productCents)*0.05);
  assert.equal(10000+1990-coupon.totalCents-pix,10540);
});

test("frete grátis e cupom manual válido são respeitados",()=>{
  const {db,items}=fixture();
  db.prepare(`INSERT INTO coupons${couponColumns} VALUES(5,'FRETE',NULL,'shipping',0,0,'all',NULL,NULL,0,NULL,NULL,1)`).run();
  redeemCoupon(db,1,"FRETE");redeemCoupon(db,1,"LOJA20");
  assert.equal(bestCoupon(db,1,items,2990)?.coupon.code,"LOJA20");
  assert.equal(bestCoupon(db,1,items,2990,0,5)?.coupon.code,"FRETE");
  db.close();
});

test("cupom de frete restrito a luvas cobre apenas a fração do frete das luvas",()=>{
  const {db,items}=fixture();
  db.prepare(`INSERT INTO coupons${couponColumns} VALUES(5,'FRETELUVA',NULL,'shipping',0,0,'category','luvas',NULL,0,NULL,NULL,1)`).run();
  const coupon=redeemCoupon(db,1,"FRETELUVA"),discount=evaluateCoupon(db,coupon,items,3000);
  assert.equal(discount.eligibleSubtotalCents,10000);
  assert.equal(discount.shippingCents,500);
  db.close();
});

function placeOrder(db:ReturnType<typeof testDb>,customerId:number,couponId:number|null,status="pending"){
  db.prepare("INSERT INTO orders(customer_id,coupon_id,order_number,status,payment_method,payment_status,subtotal_cents,total_cents,shipping_method,shipping_address_json) VALUES(?,?,?,?,'pix','pending',1,1,'Econômica','{}')").run(customerId,couponId,`O-${Math.random()}`,status);
}

test("cupom de primeira compra some depois do primeiro pedido e volta se ele for cancelado",()=>{
  const {db,items}=fixture();
  db.exec(`INSERT INTO coupons${couponColumns.replace(")",",first_order_only,per_customer_limit)")} VALUES(6,'BEMVINDO',NULL,'percent',10,0,'all',NULL,NULL,0,NULL,NULL,1,1,1)`);
  redeemCoupon(db,1,"BEMVINDO");
  assert.equal(bestCoupon(db,1,items,0)?.coupon.code,"BEMVINDO");
  placeOrder(db,1,6);
  assert.equal(activeCustomerCoupons(db,1).some(coupon=>coupon.code==="BEMVINDO"),false);
  assert.throws(()=>requireOwnedApplicableCoupon(db,1,"BEMVINDO",items,0),/não está disponível/);
  db.exec("UPDATE orders SET status='cancelled' WHERE customer_id=1");
  assert.equal(activeCustomerCoupons(db,1).some(coupon=>coupon.code==="BEMVINDO"),true);
  placeOrder(db,2,null,"delivered");
  assert.throws(()=>redeemCoupon(db,2,"BEMVINDO"),/primeira compra/);
  db.close();
});

test("limite por cliente conta só pedidos que ainda usam o cupom",()=>{
  const {db}=fixture();
  db.exec("UPDATE coupons SET per_customer_limit=2 WHERE id=2");
  redeemCoupon(db,1,"LOJA20");
  placeOrder(db,1,2,"paid");placeOrder(db,1,2,"refunded");
  assert.equal(activeCustomerCoupons(db,1).some(coupon=>coupon.id===2),true);
  placeOrder(db,1,2,"delivered");
  assert.equal(activeCustomerCoupons(db,1).some(coupon=>coupon.id===2),false);
  assert.throws(()=>redeemCoupon(db,1,"LOJA20"),/número máximo/);
  db.close();
});
