import { getDb } from "@/lib/db";
import { getStoreSettings } from "@/lib/store-settings";

export type ShippingAddress={zip_code:string;district?:string;city?:string;state?:string};
export type ShippingMethod="standard"|"express"|"pickup";
export type FreeShippingRegion={id:number;name:string;cep_prefix:string|null;district:string|null;city:string|null;state:string|null;applies_to:"standard"|"all";starts_at:string|null;ends_at:string|null};

const normalize=(value?:string|null)=>(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
const digits=(value?:string|null)=>(value||"").replace(/\D/g,"");

export function findFreeShippingRegion(address:ShippingAddress,method:ShippingMethod="standard",now=new Date()){
  if(method==="pickup")return null;
  const rules=getDb().prepare("SELECT id,name,cep_prefix,district,city,state,applies_to,starts_at,ends_at FROM free_shipping_regions WHERE active=1 ORDER BY id DESC").all() as FreeShippingRegion[];
  return rules.find(rule=>{
    if(method==="express"&&rule.applies_to!=="all")return false;
    if(rule.starts_at&&new Date(rule.starts_at).getTime()>now.getTime())return false;
    if(rule.ends_at&&new Date(rule.ends_at).getTime()<now.getTime())return false;
    if(rule.cep_prefix&&!digits(address.zip_code).startsWith(digits(rule.cep_prefix)))return false;
    if(rule.district&&normalize(address.district)!==normalize(rule.district))return false;
    if(rule.city&&normalize(address.city)!==normalize(rule.city))return false;
    if(rule.state&&normalize(address.state)!==normalize(rule.state))return false;
    return true;
  })||null;
}

export function calculateShipping(subtotalCents:number,address:ShippingAddress,method:ShippingMethod="standard"){
  const settings=getStoreSettings();
  const rule=findFreeShippingRegion(address,method);
  if(method==="pickup")return {shipping_cents:0,free_shipping:true,reason:"pickup" as const,rule:null};
  if(subtotalCents>=settings.free_shipping_threshold_cents)return {shipping_cents:0,free_shipping:true,reason:"threshold" as const,rule:null};
  if(rule)return {shipping_cents:0,free_shipping:true,reason:"region" as const,rule};
  return {shipping_cents:method==="express"?settings.express_shipping_cents:settings.standard_shipping_cents,free_shipping:false,reason:"price" as const,rule:null};
}
