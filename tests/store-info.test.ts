import test from "node:test";
import assert from "node:assert/strict";
import { fillLegalDocument,isValidCnpj,storeAddress,storeInfoKeys,type StoreInfo } from "../lib/store-info.ts";

const empty=Object.fromEntries(storeInfoKeys.map(key=>[key,""])) as StoreInfo;

test("CNPJ confere os dígitos verificadores",()=>{
  assert.equal(isValidCnpj("11.222.333/0001-81"),true);
  assert.equal(isValidCnpj("11222333000181"),true);
  assert.equal(isValidCnpj("11.222.333/0001-82"),false);
  assert.equal(isValidCnpj("11.111.111/1111-11"),false);
  assert.equal(isValidCnpj("123"),false);
});

test("termos usam os dados da loja e apontam o que falta",()=>{
  const info={...empty,legal_name:"Ridekit Comércio LTDA",cnpj:"11.222.333/0001-81",support_email:"ajuda@loja.com",address_street:"Rua A",address_number:"10",address_city:"São Paulo",address_state:"SP",address_zip:"01001-000"};
  const {text,missing}=fillLegalDocument("[RAZÃO SOCIAL DA EMPRESA] · [CNPJ] · [ENDEREÇO COMPLETO] · [E-MAIL DE PRIVACIDADE] · [DOMÍNIO OFICIAL DA RIDEKIT]",info);
  assert.equal(text,"Ridekit Comércio LTDA · 11.222.333/0001-81 · Rua A, 10 · São Paulo/SP · CEP 01001-000 · ajuda@loja.com · [DOMÍNIO OFICIAL DA RIDEKIT]");
  assert.deepEqual(missing,["domínio oficial da ridekit"]);
  assert.equal(storeAddress(empty),"");
});
