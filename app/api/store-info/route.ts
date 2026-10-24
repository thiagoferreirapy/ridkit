import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-auth";
import { apiError,ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { httpUrl,imageLocation } from "@/lib/schemas";
import { isValidCnpj } from "@/lib/store-info";
import { getStoreSettings,saveStoreSettings } from "@/lib/store-settings";

export const runtime="nodejs";

const text=(max:number)=>z.string().trim().max(max).default("");
const optional=<T extends z.ZodTypeAny>(schema:T)=>z.union([z.literal(""),schema]).default("");
const digits=(value:string)=>value.replace(/\D/g,"");
const schema=z.object({
  legal_name:text(160),
  cnpj:z.string().trim().default("").refine(value=>!value||isValidCnpj(value),"CNPJ inválido").transform(value=>value&&digits(value).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5")),
  state_registration:text(30),
  support_email:optional(z.string().trim().toLowerCase().email("E-mail de atendimento inválido").max(160)),
  privacy_email:optional(z.string().trim().toLowerCase().email("E-mail de privacidade inválido").max(160)),
  phone:z.string().trim().default("").refine(value=>!value||[10,11,12,13].includes(digits(value).length),"Telefone inválido"),
  business_hours:text(160),
  address_zip:z.string().trim().default("").refine(value=>!value||digits(value).length===8,"CEP inválido").transform(value=>value&&digits(value).replace(/^(\d{5})(\d{3})$/,"$1-$2")),
  address_street:text(160),address_number:text(20),address_complement:text(80),address_district:text(80),address_city:text(80),
  address_state:z.string().trim().toUpperCase().default("").refine(value=>!value||/^[A-Z]{2}$/.test(value),"UF inválida"),
  logo_url:optional(imageLocation),
  site_url:optional(httpUrl),instagram_url:optional(httpUrl),facebook_url:optional(httpUrl),tiktok_url:optional(httpUrl),youtube_url:optional(httpUrl),
});

export async function PATCH(request:Request){try{
  const admin=await requireAdminPermission("settings.manage"),body=await request.json(),value=schema.parse(body);
  // Only the fields sent are saved, so a partial PATCH does not blank the others.
  saveStoreSettings(Object.fromEntries(Object.entries(value).filter(([key])=>body&&typeof body==="object"&&key in body)));audit(admin.id,"update","store_info",undefined,{cnpj:value.cnpj});
  return ok(getStoreSettings());
}catch(error){return apiError(error);}}
