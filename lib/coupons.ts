import type { DatabaseSync } from "node:sqlite";

export type CouponRule={id:number;code:string;description:string|null;discount_type:"percent"|"fixed"|"shipping";discount_value:number;min_order_cents:number;scope_type:"all"|"category"|"product";scope_value:string|null;usage_limit:number|null;used_count:number;ends_at:string|null};
export type CouponItem={product_id:number;category_id:number;price_cents:number;quantity:number};
export type CouponEvaluation={coupon:CouponRule;eligibleSubtotalCents:number;missingCents:number;productCents:number;shippingCents:number;totalCents:number;netSavingsCents:number};

const activeSql="c.active=1 AND (c.starts_at IS NULL OR c.starts_at<=CURRENT_TIMESTAMP) AND (c.ends_at IS NULL OR c.ends_at>=CURRENT_TIMESTAMP) AND (c.usage_limit IS NULL OR c.used_count<c.usage_limit)";
const selectedColumns="c.id,c.code,c.description,c.discount_type,c.discount_value,c.min_order_cents,c.scope_type,c.scope_value,c.usage_limit,c.used_count,c.ends_at";
const money=(cents:number)=>(cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function assertCouponScope(db:DatabaseSync,scopeType:string,scopeValue:string|null){
  if(scopeType==="all")return;
  if(!scopeValue)throw new Error("BAD_REQUEST:Informe o slug da categoria ou do produto do cupom");
  const table=scopeType==="category"?"categories":scopeType==="product"?"products":null;
  if(!table||!db.prepare(`SELECT id FROM ${table} WHERE slug=?`).get(scopeValue))throw new Error("BAD_REQUEST:Categoria ou produto do cupom não encontrado");
}

export function activeCustomerCoupons(db:DatabaseSync,customerId:number):CouponRule[]{
  return db.prepare(`SELECT ${selectedColumns} FROM coupons c JOIN customer_coupons cc ON cc.coupon_id=c.id WHERE cc.customer_id=? AND ${activeSql} ORDER BY c.code`).all(customerId) as CouponRule[];
}

export function redeemCoupon(db:DatabaseSync,customerId:number,code:string):CouponRule{
  const normalized=code.trim().toUpperCase();
  if(!normalized||normalized.length>40)throw new Error("BAD_REQUEST:Informe um código de cupom válido");
  const coupon=db.prepare(`SELECT ${selectedColumns} FROM coupons c WHERE upper(c.code)=? AND ${activeSql}`).get(normalized) as CouponRule|undefined;
  if(!coupon)throw new Error("BAD_REQUEST:Cupom inválido, esgotado ou expirado");
  db.prepare("INSERT INTO customer_coupons(customer_id,coupon_id) VALUES(?,?) ON CONFLICT(customer_id,coupon_id) DO NOTHING").run(customerId,coupon.id);
  return coupon;
}

function categoryMatches(db:DatabaseSync,categoryId:number,slug:string){
  const result=db.prepare("WITH RECURSIVE parents(id,parent_id,slug) AS (SELECT id,parent_id,slug FROM categories WHERE id=? UNION ALL SELECT c.id,c.parent_id,c.slug FROM categories c JOIN parents p ON c.id=p.parent_id) SELECT 1 AS match FROM parents WHERE slug=? LIMIT 1").get(categoryId,slug) as {match:number}|undefined;
  return Boolean(result);
}

export function eligibleSubtotal(db:DatabaseSync,coupon:CouponRule,items:CouponItem[]):number{
  if(coupon.scope_type==="all")return items.reduce((sum,item)=>sum+item.price_cents*item.quantity,0);
  if(!coupon.scope_value)return 0;
  if(coupon.scope_type==="product")return items.reduce((sum,item)=>{
    const product=db.prepare("SELECT slug FROM products WHERE id=?").get(item.product_id) as {slug:string}|undefined;
    return sum+(product?.slug===coupon.scope_value?item.price_cents*item.quantity:0);
  },0);
  return items.reduce((sum,item)=>sum+(categoryMatches(db,item.category_id,coupon.scope_value!)?item.price_cents*item.quantity:0),0);
}

export function couponDiscount(coupon:(Pick<CouponRule,"discount_type"|"discount_value">&{scope_type?:CouponRule["scope_type"]})|null,eligibleCents:number,shippingCents:number,cartSubtotalCents=eligibleCents){
  if(!coupon)return {productCents:0,shippingCents:0,totalCents:0};
  const productCents=coupon.discount_type==="percent"?Math.min(eligibleCents,Math.max(0,Math.round(eligibleCents*coupon.discount_value/100))):coupon.discount_type==="fixed"?Math.min(eligibleCents,Math.max(0,coupon.discount_value)):0;
  const shippingDiscountCents=coupon.discount_type==="shipping"?(coupon.scope_type&&coupon.scope_type!=="all"&&cartSubtotalCents>0?Math.round(shippingCents*eligibleCents/cartSubtotalCents):shippingCents):0;
  return {productCents,shippingCents:shippingDiscountCents,totalCents:productCents+shippingDiscountCents};
}

export function evaluateCoupon(db:DatabaseSync,coupon:CouponRule,items:CouponItem[],shippingCents:number,pixPercent=0):CouponEvaluation{
  const eligibleSubtotalCents=eligibleSubtotal(db,coupon,items);
  const missingCents=Math.max(0,coupon.min_order_cents-eligibleSubtotalCents);
  const cartSubtotalCents=items.reduce((sum,item)=>sum+item.price_cents*item.quantity,0);
  const discount=eligibleSubtotalCents>0&&missingCents===0?couponDiscount(coupon,eligibleSubtotalCents,shippingCents,cartSubtotalCents):couponDiscount(null,0,0);
  const netSavingsCents=discount.totalCents-Math.round(discount.productCents*pixPercent/100);
  return {coupon,eligibleSubtotalCents,missingCents,...discount,netSavingsCents};
}

export function bestCoupon(db:DatabaseSync,customerId:number,items:CouponItem[],shippingCents:number,pixPercent=0,manualCouponId?:number|null):CouponEvaluation|null{
  const evaluated=activeCustomerCoupons(db,customerId).map(coupon=>evaluateCoupon(db,coupon,items,shippingCents,pixPercent)).filter(result=>result.totalCents>0);
  if(manualCouponId){const manual=evaluated.find(result=>result.coupon.id===manualCouponId);if(manual)return manual;}
  evaluated.sort((a,b)=>b.netSavingsCents-a.netSavingsCents||b.totalCents-a.totalCents||a.coupon.id-b.coupon.id);
  return evaluated[0]||null;
}

export function requireOwnedApplicableCoupon(db:DatabaseSync,customerId:number,code:string,items:CouponItem[],shippingCents:number,pixPercent=0):CouponEvaluation{
  const coupon=activeCustomerCoupons(db,customerId).find(item=>item.code.toUpperCase()===code.trim().toUpperCase());
  if(!coupon)throw new Error("BAD_REQUEST:Este cupom não está disponível na sua conta");
  const result=evaluateCoupon(db,coupon,items,shippingCents,pixPercent);
  if(result.eligibleSubtotalCents===0)throw new Error("BAD_REQUEST:Este cupom não se aplica aos produtos do carrinho");
  if(result.missingCents>0)throw new Error(`BAD_REQUEST:Adicione mais ${money(result.missingCents)} em produtos elegíveis para usar este cupom`);
  if(result.totalCents<=0)throw new Error("BAD_REQUEST:Este cupom não reduz o valor deste pedido");
  return result;
}
