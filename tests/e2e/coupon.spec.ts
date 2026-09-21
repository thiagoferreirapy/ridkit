import { expect,test } from "@playwright/test";

test("cupom pode ser aplicado no carrinho e acompanha o checkout",async({page})=>{
  let couponCode="";
  await page.route("**/api/auth/me",route=>route.fulfill({json:{data:{user:{id:1,name:"Cliente",email:"cliente@example.com"}}}}));
  await page.route("**/api/cart?**",route=>route.fulfill({json:{data:{
    session_id:"teste-cupom",items:[{id:1,variant_id:1,product_id:1,name:"Produto de teste",slug:"produto-de-teste",brand:"Ridekit",size:"M",color:"Preto",price_cents:10000,quantity:1,total_cents:10000}],
    coupon:couponCode?{code:couponCode,description:"Cupom de teste",discount_type:"fixed",discount_value:1000,eligible_subtotal_cents:10000,scope_type:"all",scope_value:null}:null,
    coupon_manual:false,
    summary:{items:1,subtotal_cents:10000,shipping_cents:0,total_cents:couponCode?9000:10000}
  }}}));
  await page.route(/\/api\/cart\/coupon(?:\?.*)?$/,route=>{
    if(route.request().method()==="GET")return route.fulfill({json:{data:{items:[{code:"TESTE10",description:"Cupom de teste",discount_type:"fixed",discount_value:1000,min_order_cents:0,scope_type:"all",scope_label:"Toda a loja",eligible_subtotal_cents:10000,missing_cents:0,estimated_discount_cents:1000,ends_at:null}]}}});
    couponCode=route.request().method()==="DELETE"?"":String(route.request().postDataJSON().code).toUpperCase();
    return route.fulfill({json:{data:{code:couponCode,applied:true}}});
  });
  await page.goto("/carrinho");
  await page.getByRole("button",{name:/Cupom de desconto/}).click();
  await expect(page.getByRole("heading",{name:"Meus cupons",exact:true})).toBeVisible();
  await expect(page.getByText("10,00 OFF")).toBeVisible();
  await page.getByRole("textbox",{name:"Código do cupom"}).fill("teste10");
  await page.getByRole("button",{name:"Resgatar",exact:true}).click();
  await expect(page.getByText("Cupom TESTE10")).toBeVisible();
  await expect(page.getByText("R$ 90,00")).toBeVisible();
  await page.goto("/checkout/identificacao");
  await expect(page.getByText("Cupom TESTE10")).toBeVisible();
  const couponButton=await page.getByRole("button",{name:/Cupom de desconto/}).boundingBox();
  const continueButton=await page.getByRole("button",{name:"Continuar",exact:true}).boundingBox();
  expect(couponButton&&continueButton&&continueButton.y-(couponButton.y+couponButton.height)).toBeGreaterThanOrEqual(24);
  await page.getByRole("button",{name:/Cupom de desconto/}).click();
  await expect(page.getByRole("heading",{name:"Meus cupons",exact:true})).toBeVisible();
});
