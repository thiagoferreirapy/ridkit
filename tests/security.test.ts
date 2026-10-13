import test from "node:test";
import assert from "node:assert/strict";
import { resources } from "../lib/resources.ts";
import { linkTarget,imageLocation } from "../lib/schemas.ts";
import { parseStoreDate,STORE_NOW_SQL } from "../lib/store-time.ts";
import { consumeTotp,createTotpSecret,totp } from "../lib/two-factor.ts";
import { assertRateLimit,assertRateLimitFor } from "../lib/rate-limit.ts";
import { activeCustomerCoupons,redeemCoupon } from "../lib/coupons.ts";
import { insertCustomer,testDb } from "./helpers/db.ts";

test("CRUD de clientes não aceita password_hash",()=>{
  const parsed=resources.customers.schema.partial().parse({name:"Cliente",password_hash:"salt:hash"});
  assert.equal("password_hash" in parsed,false);
});

test("links e imagens recusam javascript: e data:",()=>{
  for(const value of ["javascript:alert(1)","data:text/html,<script>","//evil.example/path"])assert.equal(linkTarget.safeParse(value).success,false,value);
  for(const value of ["/ofertas","https://loja.example/x"])assert.equal(linkTarget.safeParse(value).success,true,value);
  assert.equal(imageLocation.safeParse("javascript:alert(1)").success,false);
  assert.equal(imageLocation.safeParse("/uploads/foto-1.png").success,true);
});

test("datas digitadas no admin são horário de Brasília",()=>{
  assert.equal(parseStoreDate("2026-10-13T09:00").toISOString(),"2026-10-13T12:00:00.000Z");
  assert.equal(parseStoreDate("2026-10-13").toISOString(),"2026-10-13T03:00:00.000Z");
  assert.equal(parseStoreDate("2026-10-13 09:00:00").toISOString(),"2026-10-13T12:00:00.000Z");
  assert.equal(parseStoreDate("2026-10-13T09:00:00Z").toISOString(),"2026-10-13T09:00:00.000Z");
});

test("cupom criado com datetime-local vale a partir do horário informado, não do dia seguinte",()=>{
  const db=testDb();insertCustomer(db,1);
  const local=(offsetMinutes:number)=>(db.prepare(`SELECT strftime('%Y-%m-%dT%H:%M',${STORE_NOW_SQL},?) AS value`).get(`${offsetMinutes} minutes`) as {value:string}).value;
  db.prepare("INSERT INTO coupons(code,discount_type,discount_value,starts_at,ends_at) VALUES('JA',  'percent',10,?,?)").run(local(-5),local(60));
  db.prepare("INSERT INTO coupons(code,discount_type,discount_value,starts_at,ends_at) VALUES('DEPOIS','percent',10,?,NULL)").run(local(30));
  db.prepare("INSERT INTO coupons(code,discount_type,discount_value,starts_at,ends_at) VALUES('ACABOU','percent',10,NULL,?)").run(local(-5));
  redeemCoupon(db,1,"JA");
  assert.throws(()=>redeemCoupon(db,1,"DEPOIS"));
  assert.throws(()=>redeemCoupon(db,1,"ACABOU"));
  assert.deepEqual(activeCustomerCoupons(db,1).map(coupon=>coupon.code),["JA"]);
  db.close();
});

test("token de redefinição em ISO expira no horário certo, não na meia-noite",()=>{
  const db=testDb();
  const past=new Date(Date.now()-60_000).toISOString(),future=new Date(Date.now()+60_000).toISOString();
  const valid=(value:string)=>(db.prepare("SELECT datetime(?)>CURRENT_TIMESTAMP AS ok").get(value) as {ok:number}).ok;
  assert.equal(valid(past),0);
  assert.equal(valid(future),1);
  db.close();
});

test("código TOTP não pode ser reutilizado",()=>{
  const secret=createTotpSecret(),counter=Math.floor(Date.now()/30_000),code=totp(secret,counter);
  const first=consumeTotp(secret,code,null);
  assert.equal(first,counter);
  assert.equal(consumeTotp(secret,code,first),null);
});

test("limite por conta não é burlado trocando X-Forwarded-For",()=>{
  const email=`vitima-${Math.random()}@example.com`;
  for(let attempt=0;attempt<3;attempt++){
    const request=new Request("http://localhost/api/auth/login",{headers:{"x-forwarded-for":`10.0.0.${attempt}`}});
    assertRateLimit(request,"test-login",100);assertRateLimitFor("test-login",email,3,60_000);
  }
  assert.throws(()=>assertRateLimitFor("test-login",email,3,60_000),/TOO_MANY_REQUESTS/);
});
