import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

test("pedido persiste o contato validado do checkout",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec(readFileSync("data/schema.sql","utf8"));
  db.prepare("INSERT INTO customers(id,name,email) VALUES(1,'Cliente de teste','cliente@example.com')").run();
  const sql="INSERT INTO orders(customer_id,coupon_id,order_number,idempotency_key,status,payment_method,payment_status,subtotal_cents,discount_cents,shipping_cents,shipping_rule_id,shipping_rule_name,total_cents,shipping_method,shipping_address_json,checkout_contact_json) VALUES(?,?,?,?, 'pending',?,'pending',?,?,?,?,?,?,?,?,?)";
  db.prepare(sql).run(1,null,"TEST-1",null,"pix",1000,0,0,null,null,1000,"Econômica","{}",JSON.stringify({email:"cliente@example.com",cpf:"12345678909",phone:"11987654321"}));
  const row=db.prepare("SELECT checkout_contact_json FROM orders WHERE order_number='TEST-1'").get() as {checkout_contact_json:string};
  assert.equal(JSON.parse(row.checkout_contact_json).email,"cliente@example.com");
  db.close();
});
