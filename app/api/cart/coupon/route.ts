import { z } from "zod";
import { apiError,ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { activeCustomerCoupons,bestCoupon,evaluateCoupon,redeemCoupon,requireOwnedApplicableCoupon,type CouponItem } from "@/lib/coupons";
import { getStoreSettings } from "@/lib/store-settings";
import { requireUser } from "@/lib/auth";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime="nodejs";
const sessionSchema=z.object({session_id:z.string().min(6).max(120)});
type CartRow={id:number;customer_id:number|null};

function cartForSession(sessionId:string,customerId:number){
  const cart=getDb().prepare("SELECT id,customer_id FROM carts WHERE session_id=?").get(sessionId) as CartRow|undefined;
  if(cart?.customer_id&&cart.customer_id!==customerId)throw new Error("BAD_REQUEST:Este carrinho pertence a outra conta");
  return cart;
}
function cartItems(cartId:number):CouponItem[]{
  return getDb().prepare("SELECT p.id AS product_id,p.category_id,COALESCE(v.price_cents,p.price_cents) AS price_cents,ci.quantity FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id WHERE ci.cart_id=?").all(cartId) as CouponItem[];
}

export async function GET(request:Request){
  try{
    const user=await requireUser(),sessionId=new URL(request.url).searchParams.get("session_id"),db=getDb();
    if(!sessionId)throw new Error("BAD_REQUEST:session_id é obrigatório");
    const cart=cartForSession(sessionId,user.id),items=cart?cartItems(cart.id):[],subtotal=items.reduce((sum,item)=>sum+item.price_cents*item.quantity,0),settings=getStoreSettings(),shipping=subtotal>=settings.free_shipping_threshold_cents?0:settings.standard_shipping_cents;
    const coupons=activeCustomerCoupons(db,user.id).map(coupon=>{const result=evaluateCoupon(db,coupon,items,shipping,settings.pix_discount_percent),scopeLabel=coupon.scope_type==="all"?"Toda a loja":coupon.scope_type==="category"?(db.prepare("SELECT name FROM categories WHERE slug=?").get(coupon.scope_value) as {name:string}|undefined)?.name:(db.prepare("SELECT name FROM products WHERE slug=?").get(coupon.scope_value) as {name:string}|undefined)?.name;return {...coupon,scope_label:scopeLabel||coupon.scope_value||"Toda a loja",eligible_subtotal_cents:result.eligibleSubtotalCents,missing_cents:result.missingCents,estimated_discount_cents:result.totalCents};});
    return ok({items:coupons});
  }catch(error){return apiError(error);}
}

export async function POST(request:Request){
  try{
    assertRateLimit(request,"redeem-coupon",15,10*60_000);
    const user=await requireUser(),value=sessionSchema.extend({code:z.string().trim().min(1).max(40),select:z.boolean().optional().default(false)}).parse(await request.json()),db=getDb(),cart=cartForSession(value.session_id,user.id);
    const coupon=redeemCoupon(db,user.id,value.code);
    let applied=false;
    if(cart){const items=cartItems(cart.id),subtotal=items.reduce((sum,item)=>sum+item.price_cents*item.quantity,0),settings=getStoreSettings(),shipping=subtotal>=settings.free_shipping_threshold_cents?0:settings.standard_shipping_cents;
      if(value.select){requireOwnedApplicableCoupon(db,user.id,coupon.code,items,shipping,settings.pix_discount_percent);db.prepare("UPDATE carts SET coupon_id=?,customer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(coupon.id,user.id,cart.id);applied=true;}
      else{db.prepare("UPDATE carts SET coupon_id=NULL,customer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(user.id,cart.id);applied=bestCoupon(db,user.id,items,shipping,settings.pix_discount_percent)?.coupon.id===coupon.id;}
    }
    return ok({code:coupon.code,redeemed:true,applied});
  }catch(error){return apiError(error);}
}

export async function DELETE(request:Request){
  try{const user=await requireUser(),value=sessionSchema.parse(await request.json()),cart=cartForSession(value.session_id,user.id);if(cart)getDb().prepare("UPDATE carts SET coupon_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(cart.id);return ok({automatic:true});}
  catch(error){return apiError(error);}
}
