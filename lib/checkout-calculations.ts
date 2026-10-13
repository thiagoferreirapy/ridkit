export type CheckoutShipping="Econômica"|"Expressa"|"Retirada";
export type CheckoutAddress={zip_code?:string;street?:string;number?:string;district?:string;city?:string;state?:string};
export type CheckoutIdentity={email:string;cpf:string;phone:string};

// Check digits per Receita Federal; the payment provider rejects CPFs that fail them.
export function validCpf(value:string){
  const cpf=value.replace(/\D/g,"");
  if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
  const digit=(length:number)=>{let sum=0;for(let index=0;index<length;index++)sum+=Number(cpf[index])*(length+1-index);const rest=(sum*10)%11;return rest===10?0:rest;};
  return digit(9)===Number(cpf[9])&&digit(10)===Number(cpf[10]);
}

export function validateCheckoutIdentity(identity:Partial<CheckoutIdentity>){
  const email=String(identity.email||"").trim().toLowerCase();
  const cpf=String(identity.cpf||"").replace(/\D/g,"");
  const phone=String(identity.phone||"").replace(/\D/g,"");
  const missing:string[]=[];
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))missing.push("e-mail válido");
  if(!validCpf(cpf))missing.push("CPF válido");
  if(phone.length!==10&&phone.length!==11)missing.push("telefone com DDD");
  return {valid:missing.length===0,missing,normalized:{email,cpf,phone}};
}

export function validateCheckoutAddress(address:CheckoutAddress){
  const missing=(Object.keys({zip_code:1,street:1,number:1,district:1,city:1,state:1}) as (keyof CheckoutAddress)[]).filter(key=>!String(address[key]||"").trim());
  return {valid:missing.length===0,missing};
}
