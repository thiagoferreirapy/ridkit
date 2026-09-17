export type CheckoutShipping="Econômica"|"Expressa"|"Retirada";
export type CheckoutAddress={zip_code?:string;street?:string;number?:string;district?:string;city?:string;state?:string};

export function calculateCheckoutTotals(subtotalCents:number,shipping:CheckoutShipping,expressShippingCents:number,pixDiscountPercent:number){
  const shippingCents=shipping==="Expressa"?expressShippingCents:0;
  const discountCents=Math.round(subtotalCents*Math.max(0,pixDiscountPercent)/100);
  return {subtotalCents,shippingCents,discountCents,totalCents:Math.max(0,subtotalCents+shippingCents-discountCents)};
}

export function validateCheckoutAddress(address:CheckoutAddress){
  const missing=(Object.keys({zip_code:1,street:1,number:1,district:1,city:1,state:1}) as (keyof CheckoutAddress)[]).filter(key=>!String(address[key]||"").trim());
  return {valid:missing.length===0,missing};
}
