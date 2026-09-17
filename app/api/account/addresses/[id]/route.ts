import { z } from "zod";
import { apiError,ok,parseId } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema=z.object({label:z.string().trim().min(1).max(40).optional(),zip_code:z.string().trim().min(8).optional(),street:z.string().trim().min(2).optional(),number:z.string().trim().min(1).optional(),complement:z.string().trim().nullable().optional(),district:z.string().trim().min(2).optional(),city:z.string().trim().min(2).optional(),state:z.string().trim().length(2).transform(v=>v.toUpperCase()).optional(),is_default:z.coerce.number().int().min(0).max(1).optional()});

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const db=getDb();try{const user=await requireUser(),id=parseId((await params).id),value=schema.parse(await request.json());const current=db.prepare("SELECT id FROM addresses WHERE id=? AND customer_id=?").get(id,user.id);if(!current)throw new Error("NOT_FOUND");db.exec("BEGIN IMMEDIATE");if(value.is_default)db.prepare("UPDATE addresses SET is_default=0 WHERE customer_id=?").run(user.id);const entries=Object.entries(value).map(([key,val])=>[key,key==="is_default"?(val?1:0):val] as const);if(entries.length)db.prepare(`UPDATE addresses SET ${entries.map(([key])=>`${key}=?`).join(",")} WHERE id=? AND customer_id=?`).run(...entries.map(([,val])=>val),id,user.id);db.exec("COMMIT");return ok({updated:true});}catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){try{const user=await requireUser(),id=parseId((await params).id),result=getDb().prepare("DELETE FROM addresses WHERE id=? AND customer_id=?").run(id,user.id);if(!result.changes)throw new Error("NOT_FOUND");return ok({deleted:true});}catch(error){return apiError(error);}}
