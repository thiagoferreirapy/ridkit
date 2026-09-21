import test from "node:test";
import assert from "node:assert/strict";
import { calculateCheckoutTotals,validateCheckoutAddress,validateCheckoutIdentity } from "../lib/checkout-calculations.ts";

test("calcula desconto Pix e frete expresso",()=>{assert.deepEqual(calculateCheckoutTotals(10000,"Expressa",2990,5),{subtotalCents:10000,shippingCents:2990,discountCents:500,totalCents:12490});});
test("retirada não cobra frete",()=>{assert.equal(calculateCheckoutTotals(10000,"Retirada",2990,5).totalCents,9500);});
test("valida endereço completo",()=>{assert.equal(validateCheckoutAddress({zip_code:"01001000",street:"Praça da Sé",number:"1",district:"Sé",city:"São Paulo",state:"SP"}).valid,true);});
test("informa campos ausentes",()=>{assert.deepEqual(validateCheckoutAddress({zip_code:"01001000"}).missing,["street","number","district","city","state"]);});
test("não permite avançar sem identificação completa",()=>{assert.deepEqual(validateCheckoutIdentity({email:"",cpf:"",phone:""}).missing,["e-mail válido","CPF com 11 dígitos","telefone com DDD"]);});
test("normaliza dados da identificação",()=>{assert.deepEqual(validateCheckoutIdentity({email:" CLIENTE@EXEMPLO.COM ",cpf:"123.456.789-09",phone:"(11) 98765-4321"}).normalized,{email:"cliente@exemplo.com",cpf:"12345678909",phone:"11987654321"});});
