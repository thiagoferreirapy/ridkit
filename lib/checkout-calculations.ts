export type CheckoutShipping="Econômica"|"Expressa"|"Retirada";
export type CheckoutAddress={zip_code?:string;street?:string;number?:string;district?:string;city?:string;state?:string};
export type CheckoutIdentity={email:string;cpf:string;phone:string};

export function validateCheckoutIdentity(identity:Partial<CheckoutIdentity>){
  const email=String(identity.email||"").trim().toLowerCase();
  const cpf=String(identity.cpf||"").replace(/\D/g,"");
  const phone=String(identity.phone||"").replace(/\D/g,"");
  const missing:string[]=[];
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))missing.push("e-mail válido");
  if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))missing.push("CPF com 11 dígitos");
  if(phone.length!==10&&phone.length!==11)missing.push("telefone com DDD");
  return {valid:missing.length===0,missing,normalized:{email,cpf,phone}};
}

export function calculateCheckoutTotals(subtotalCents:number,shipping:CheckoutShipping,expressShippingCents:number,pixDiscountPercent:number){
  const shippingCents=shipping==="Expressa"?expressShippingCents:0;
  const discountCents=Math.round(subtotalCents*Math.max(0,pixDiscountPercent)/100);
  return {subtotalCents,shippingCents,discountCents,totalCents:Math.max(0,subtotalCents+shippingCents-discountCents)};
}

export function validateCheckoutAddress(address:CheckoutAddress){
  const missing=(Object.keys({zip_code:1,street:1,number:1,district:1,city:1,state:1}) as (keyof CheckoutAddress)[]).filter(key=>!String(address[key]||"").trim());
  return {valid:missing.length===0,missing};
}
