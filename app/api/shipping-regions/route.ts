import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError,created,ok } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getDb } from "@/lib/db";

export const runtime="nodejs";

const optionalText=z.union([z.string().trim().max(100),z.null()]).optional().transform(value=>value||null);
const optionalDate=z.union([z.string().datetime({local:true}),z.literal(""),z.null()]).optional().transform(value=>value||null);
const baseSchema=z.object({
  name:z.string().trim().min(2).max(100),
  cep_prefix:z.union([z.string(),z.null()]).optional().transform(value=>(value||"").replace(/\D/g,"")||null).refine(value=>value===null||(value.length>=3&&value.length<=8),"Use de 3 a 8 dígitos no prefixo do CEP"),
  district:optionalText,
  city:optionalText,
  state:z.union([z.string(),z.null()]).optional().transform(value=>(value||"").trim().toUpperCase()||null).refine(value=>value===null||value.length===2,"UF inválida"),
  applies_to:z.enum(["standard","all"]).default("standard"),
  active:z.coerce.number().int().min(0).max(1).default(1),
  starts_at:optionalDate,
  ends_at:optionalDate,
}).superRefine((value,context)=>{
  if(!value.cep_prefix&&!value.district&&!value.city&&!value.state)context.addIssue({code:"custom",message:"Informe CEP, bairro, cidade ou estado"});
  if(value.starts_at&&value.ends_at&&new Date(value.starts_at)>new Date(value.ends_at))context.addIssue({code:"custom",message:"A data final deve ser posterior à inicial",path:["ends_at"]});
});

export async function GET(){try{await requireAdmin();const items=getDb().prepare("SELECT * FROM free_shipping_regions ORDER BY active DESC,id DESC").all();return ok({items});}catch(error){return apiError(error);}}

export async function POST(request:Request){try{const admin=await requireAdmin(["admin","manager"]),value=baseSchema.parse(await request.json()),db=getDb();const result=db.prepare("INSERT INTO free_shipping_regions(name,cep_prefix,district,city,state,applies_to,active,starts_at,ends_at) VALUES(?,?,?,?,?,?,?,?,?)").run(value.name,value.cep_prefix,value.district,value.city,value.state,value.applies_to,value.active,value.starts_at,value.ends_at);audit(admin.id,"create","free_shipping_regions",Number(result.lastInsertRowid),value);return created({id:Number(result.lastInsertRowid),...value});}catch(error){return apiError(error);}}

export async function PATCH(request:Request){try{const admin=await requireAdmin(["admin","manager"]),raw=await request.json(),id=z.coerce.number().int().positive().parse(raw.id),value=baseSchema.parse(raw),db=getDb();const result=db.prepare("UPDATE free_shipping_regions SET name=?,cep_prefix=?,district=?,city=?,state=?,applies_to=?,active=?,starts_at=?,ends_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(value.name,value.cep_prefix,value.district,value.city,value.state,value.applies_to,value.active,value.starts_at,value.ends_at,id);if(!result.changes)throw new Error("NOT_FOUND");audit(admin.id,"update","free_shipping_regions",id,value);return ok({id,...value});}catch(error){return apiError(error);}}

export async function DELETE(request:Request){try{const admin=await requireAdmin(["admin","manager"]),id=z.coerce.number().int().positive().parse((await request.json()).id),result=getDb().prepare("DELETE FROM free_shipping_regions WHERE id=?").run(id);if(!result.changes)throw new Error("NOT_FOUND");audit(admin.id,"delete","free_shipping_regions",id);return ok({id});}catch(error){return apiError(error);}}
