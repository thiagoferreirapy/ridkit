import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { activeCustomerCoupons,bestCoupon,couponDiscount,evaluateCoupon,redeemCoupon,requireOwnedApplicableCoupon,type CouponItem } from "../lib/coupons.ts";

function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec("CREATE TABLE categories(id INTEGER PRIMARY KEY,parent_id INTEGER,slug TEXT,name TEXT);CREATE TABLE products(id INTEGER PRIMARY KEY,category_id INTEGER,slug TEXT,name TEXT);CREATE TABLE coupons(id INTEGER PRIMARY KEY,code TEXT,description TEXT,discount_type TEXT,discount_value INTEGER,min_order_cents INTEGER,scope_type TEXT,scope_value TEXT,usage_limit INTEGER,used_count INTEGER,starts_at TEXT,ends_at TEXT,active INTEGER);CREATE TABLE customer_coupons(customer_id INTEGER,coupon_id INTEGER,PRIMARY KEY(customer_id,coupon_id))");
  db.exec("INSERT INTO categories VALUES(1,NULL,'equipamentos','Equipamentos'),(2,1,'luvas','Luvas'),(3,NULL,'capacetes','Capacetes');INSERT INTO products VALUES(10,2,'luva-teste','Luva'),(20,3,'capacete-teste','Capacete');INSERT INTO coupons VALUES(1,'LUVA50',NULL,'percent',50,0,'category','luvas',NULL,0,NULL,NULL,1),(2,'LOJA20',NULL,'percent',20,0,'all',NULL,NULL,0,NULL,NULL,1),(3,'LUVA100',NULL,'fixed',10000,15000,'category','luvas',NULL,0,NULL,NULL,1),(4,'OUTRO',NULL,'fixed',5000,0,'all',NULL,NULL,0,NULL,NULL,1)");
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
  db.prepare("INSERT INTO coupons VALUES(5,'FRETE',NULL,'shipping',0,0,'all',NULL,NULL,0,NULL,NULL,1)").run();
  redeemCoupon(db,1,"FRETE");redeemCoupon(db,1,"LOJA20");
  assert.equal(bestCoupon(db,1,items,2990)?.coupon.code,"LOJA20");
  assert.equal(bestCoupon(db,1,items,2990,0,5)?.coupon.code,"FRETE");
  db.close();
});

test("cupom de frete restrito a luvas cobre apenas a fração do frete das luvas",()=>{
  const {db,items}=fixture();
  db.prepare("INSERT INTO coupons VALUES(5,'FRETELUVA',NULL,'shipping',0,0,'category','luvas',NULL,0,NULL,NULL,1)").run();
  const coupon=redeemCoupon(db,1,"FRETELUVA"),discount=evaluateCoupon(db,coupon,items,3000);
  assert.equal(discount.eligibleSubtotalCents,10000);
  assert.equal(discount.shippingCents,500);
  db.close();
});
