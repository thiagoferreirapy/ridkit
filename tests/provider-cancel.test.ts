import test from "node:test";
import assert from "node:assert/strict";
import { cancelProviderCharges } from "../lib/reservation-expiry.ts";
import { insertCustomer,testDb } from "./helpers/db.ts";

function cancelledOrder(db:ReturnType<typeof testDb>,paymentId:string,{status="cancelled",payment="failed"}={}){
  return Number(db.prepare("INSERT INTO orders(customer_id,order_number,status,payment_method,payment_status,subtotal_cents,total_cents,shipping_method,shipping_address_json,payment_provider,provider_payment_id) VALUES(1,?,?,'pix',?,1000,1000,'Econômica','{}','asaas',?)").run(`C-${paymentId}`,status,payment,paymentId).lastInsertRowid);
}
const row=(db:ReturnType<typeof testDb>,id:number)=>db.prepare("SELECT provider_cancelled_at,provider_cancel_attempts,provider_cancel_error,attention_reason FROM orders WHERE id=?").get(id) as {provider_cancelled_at:string|null;provider_cancel_attempts:number;provider_cancel_error:string|null;attention_reason:string|null};

test("cobrança Pix de pedido cancelado é removida no Asaas uma única vez",async()=>{
  process.env.ASAAS_API_KEY="test";
  const db=testDb();insertCustomer(db,1);
  const expired=cancelledOrder(db,"pay_1"),paid=cancelledOrder(db,"pay_2",{status:"paid",payment:"approved"}),late=cancelledOrder(db,"pay_3");
  const calls:string[]=[];
  const cancel=async(id:string)=>{calls.push(id);return id==="pay_3"?"paid" as const:"deleted" as const;};
  assert.equal(await cancelProviderCharges(db,cancel),1);
  assert.deepEqual(calls,["pay_1","pay_3"],"pedido pago não é tocado");
  assert.ok(row(db,expired).provider_cancelled_at);
  assert.ok(row(db,late).provider_cancelled_at,"já recebido: o webhook resolve, não tenta de novo");
  assert.equal(row(db,paid).provider_cancelled_at,null);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM order_events WHERE order_id=? AND title='Cobrança Pix cancelada'").get(expired) as {count:number}).count,1);
  assert.equal(await cancelProviderCharges(db,cancel),0);
  assert.equal(calls.length,2);
});

test("falha ao cancelar é retentada e, no limite, vira alerta para o admin",async()=>{
  process.env.ASAAS_API_KEY="test";
  const db=testDb();insertCustomer(db,1);
  const id=cancelledOrder(db,"pay_9");
  const failing=async()=>{throw new Error("BAD_REQUEST:Asaas fora do ar");};
  await cancelProviderCharges(db,failing);
  assert.deepEqual({...row(db,id)},{provider_cancelled_at:null,provider_cancel_attempts:1,provider_cancel_error:"Asaas fora do ar",attention_reason:null});
  for(let i=0;i<9;i++)await cancelProviderCharges(db,failing);
  assert.equal(row(db,id).provider_cancel_attempts,10);
  assert.match(row(db,id).attention_reason||"",/cancelar a cobrança Pix/);
  await cancelProviderCharges(db,async()=>{throw new Error("não deveria tentar de novo");});
  assert.equal(row(db,id).provider_cancel_attempts,10);
});

test("sem chave do Asaas a varredura não faz nada",async()=>{
  delete process.env.ASAAS_API_KEY;
  const db=testDb();insertCustomer(db,1);cancelledOrder(db,"pay_x");
  assert.equal(await cancelProviderCharges(db,async()=>{throw new Error("não deveria chamar");}),0);
});
