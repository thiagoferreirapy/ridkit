// Company identity shown in the footer, legal pages and contact page; edited in Admin → Dados da loja.
// No server imports here: the storefront and the admin form use it in the browser.
export type StoreInfo={legal_name:string;cnpj:string;state_registration:string;support_email:string;privacy_email:string;phone:string;business_hours:string;address_zip:string;address_street:string;address_number:string;address_complement:string;address_district:string;address_city:string;address_state:string;logo_url:string;site_url:string;instagram_url:string;facebook_url:string;tiktok_url:string;youtube_url:string};
export const storeInfoKeys=["legal_name","cnpj","state_registration","support_email","privacy_email","phone","business_hours","address_zip","address_street","address_number","address_complement","address_district","address_city","address_state","logo_url","site_url","instagram_url","facebook_url","tiktok_url","youtube_url"] as const;

export function storeAddress(info:StoreInfo){return [[info.address_street,info.address_number].filter(Boolean).join(", "),info.address_complement,info.address_district,[info.address_city,info.address_state].filter(Boolean).join("/"),info.address_zip&&`CEP ${info.address_zip}`].filter(Boolean).join(" · ");}

const placeholders:[string,(info:StoreInfo)=>string][]=[
  ["[RAZÃO SOCIAL DA EMPRESA]",info=>info.legal_name],["[CNPJ]",info=>info.cnpj],["[ENDEREÇO COMPLETO]",info=>storeAddress(info)],
  ["[E-MAIL DE ATENDIMENTO]",info=>info.support_email],["[E-MAIL DE PRIVACIDADE]",info=>info.privacy_email||info.support_email],["[DOMÍNIO OFICIAL DA RIDEKIT]",info=>info.site_url],
];
// Fills the company placeholders of the legal documents; the ones still empty stay bracketed and are returned in `missing`.
export function fillLegalDocument(text:string,info:StoreInfo){
  const missing:string[]=[];
  for(const [token,value] of placeholders){if(!text.includes(token))continue;const filled=value(info).trim();if(filled)text=text.replaceAll(token,filled);else missing.push(token.slice(1,-1).toLowerCase());}
  return {text,missing};
}

export function isValidCnpj(value:string){
  const digits=value.replace(/\D/g,"");
  if(digits.length!==14||/^(\d)\1+$/.test(digits))return false;
  const check=(length:number)=>{let sum=0,weight=length-7;for(let i=0;i<length;i++){sum+=Number(digits[i])*weight--;if(weight<2)weight=9;}const rest=sum%11;return rest<2?0:11-rest;};
  return check(12)===Number(digits[12])&&check(13)===Number(digits[13]);
}
