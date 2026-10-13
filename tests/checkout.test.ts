import test from "node:test";
import assert from "node:assert/strict";
import { validCpf,validateCheckoutAddress,validateCheckoutIdentity } from "../lib/checkout-calculations.ts";

test("valida endereço completo",()=>{assert.equal(validateCheckoutAddress({zip_code:"01001000",street:"Praça da Sé",number:"1",district:"Sé",city:"São Paulo",state:"SP"}).valid,true);});
test("informa campos ausentes",()=>{assert.deepEqual(validateCheckoutAddress({zip_code:"01001000"}).missing,["street","number","district","city","state"]);});
test("não permite avançar sem identificação completa",()=>{assert.deepEqual(validateCheckoutIdentity({email:"",cpf:"",phone:""}).missing,["e-mail válido","CPF válido","telefone com DDD"]);});
test("normaliza dados da identificação",()=>{assert.deepEqual(validateCheckoutIdentity({email:" CLIENTE@EXEMPLO.COM ",cpf:"123.456.789-09",phone:"(11) 98765-4321"}).normalized,{email:"cliente@exemplo.com",cpf:"12345678909",phone:"11987654321"});});
test("CPF precisa ter dígitos verificadores válidos",()=>{
  assert.equal(validCpf("123.456.789-09"),true);
  for(const value of ["12345678900","11111111111","1234567890",""])assert.equal(validCpf(value),false,value);
});
