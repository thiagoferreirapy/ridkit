import { expect,test,type APIRequestContext } from "@playwright/test";

// API-level flows against the running server. They need the seeded database (pnpm db:seed) and,
// for the webhook step, the same ASAAS_WEBHOOK_TOKEN the server was started with.
const customer={email:process.env.E2E_FLOW_CUSTOMER_EMAIL||"ana-lima@example.com",password:process.env.E2E_CUSTOMER_PASSWORD||"Ridekit123!"};
const admin={email:process.env.E2E_ADMIN_EMAIL||"admin@ridekit.com.br",password:process.env.E2E_ADMIN_PASSWORD||"Admin123!"};
const webhookToken=process.env.ASAAS_WEBHOOK_TOKEN;
const legal={legal_version:"2026-09-21",accept_terms:true,acknowledge_privacy:true};

test.beforeEach(({},testInfo)=>{test.skip(testInfo.project.name!=="desktop","Fluxo de API: roda uma vez só");});

async function data(response:Awaited<ReturnType<APIRequestContext["get"]>>){const body=await response.json() as {data?:any;error?:string};expect(response.ok(),JSON.stringify(body)).toBe(true);return body.data;}

async function freeVariant(request:APIRequestContext){
  const products=await data(await request.get("/api/products?limit=100"));
  for(const product of products.items.filter((item:{available_stock:number})=>item.available_stock>=2)){
    const detail=await data(await request.get(`/api/products/${product.slug}`));
    const variant=detail.variants.find((item:{active:number;stock:number;reserved_stock:number})=>item.active&&item.stock-item.reserved_stock>=2);
    if(variant)return {slug:product.slug as string,variant};
  }
  throw new Error("Nenhuma variação com estoque livre no seed");
}

test("pedido reserva estoque, webhook confirma e o pedido aparece pago",async({playwright,baseURL})=>{
  test.skip(!webhookToken,"Defina ASAAS_WEBHOOK_TOKEN (o mesmo do servidor) para testar o webhook");
  const shopper=await playwright.request.newContext({baseURL});
  await data(await shopper.post("/api/auth/login",{data:customer}));
  const account=await data(await shopper.get("/api/account"));
  const {slug,variant}=await freeVariant(shopper);
  const order=await data(await shopper.post("/api/orders",{data:{...legal,checkout_identity:{email:customer.email,cpf:account.customer.cpf,phone:"11987654321"},payment_method:"pix",shipping_method:"Econômica",idempotency_key:crypto.randomUUID(),shipping_address:{zip_code:"01001000",street:"Praça da Sé",number:"1",district:"Sé",city:"São Paulo",state:"SP"},items:[{variant_id:variant.id,quantity:1},{variant_id:variant.id,quantity:1}]}}));
  const reserved=(await data(await shopper.get(`/api/products/${slug}`))).variants.find((item:{id:number})=>item.id===variant.id);
  expect(reserved.reserved_stock).toBe(variant.reserved_stock+2);

  const webhook=(id:string,value:number)=>shopper.post("/api/webhooks/asaas",{headers:{"asaas-access-token":webhookToken!},data:{id,event:"PAYMENT_RECEIVED",payment:{id:`pay_e2e_${order.id}`,externalReference:`ridekit-order-${order.id}`,value}}});
  expect((await (await webhook(`evt_e2e_${order.id}_wrong`,0.01)).json()).attention).toBe(true);
  expect((await (await webhook(`evt_e2e_${order.id}_ok`,order.total_cents/100)).json()).status).toBe("paid");
  expect((await (await webhook(`evt_e2e_${order.id}_ok`,order.total_cents/100)).json()).duplicate).toBe(true);

  const sold=(await data(await shopper.get(`/api/products/${slug}`))).variants.find((item:{id:number})=>item.id===variant.id);
  expect({stock:sold.stock,reserved:sold.reserved_stock}).toEqual({stock:variant.stock-2,reserved:variant.reserved_stock});
  const detail=await data(await shopper.get(`/api/orders/${order.id}`));
  expect(detail.status).toBe("paid");
  expect(detail.attention_reason).toBeNull();
  expect(detail.items.reduce((sum:number,item:{quantity:number})=>sum+item.quantity,0)).toBe(2);

  const staff=await playwright.request.newContext({baseURL});
  await data(await staff.post("/api/admin-auth/login",{data:admin}));
  const invalid=await staff.patch(`/api/orders/${order.id}`,{data:{status:"pending"}});
  expect(invalid.status()).toBe(409);
  await data(await staff.patch(`/api/orders/${order.id}`,{data:{status:"preparing"}}));
  expect((await data(await shopper.get(`/api/orders/${order.id}`))).status).toBe("preparing");
});

test("webhook sem token é recusado",async({request})=>{
  const response=await request.post("/api/webhooks/asaas",{data:{id:"x",event:"PAYMENT_RECEIVED",payment:{id:"y"}}});
  expect(response.status()).toBe(401);
});

test("admin cria, edita e desativa um cupom",async({playwright,baseURL})=>{
  const staff=await playwright.request.newContext({baseURL});
  await data(await staff.post("/api/admin-auth/login",{data:admin}));
  const code=`E2E${Date.now().toString(36).toUpperCase()}`;
  const created=await data(await staff.post("/api/coupons",{data:{code,discount_type:"percent",discount_value:10,per_customer_limit:1,first_order_only:0,active:1}}));
  await data(await staff.patch(`/api/coupons/${created.id}`,{data:{discount_value:15}}));
  const listed=await data(await staff.get(`/api/coupons?q=${code}`));
  expect(listed.items[0]).toMatchObject({code,discount_value:15,per_customer_limit:1});
  await data(await staff.delete(`/api/coupons/${created.id}`));
  expect((await data(await staff.get(`/api/coupons/${created.id}`))).active).toBe(0);
});

test("API pública não expõe custo nem rascunhos",async({request})=>{
  const products=await data(await request.get("/api/products?limit=5"));
  for(const item of products.items)expect(item).not.toHaveProperty("cost_cents");
  expect((await request.get("/api/products?admin=1")).status()).toBe(401);
});
