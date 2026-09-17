import { createHash } from "node:crypto";
import { z } from "zod";
import { apiError,ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { assertRateLimit } from "@/lib/rate-limit";

const schema=z.object({token:z.string().min(20),password:z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/)});
export async function POST(request:Request){const db=getDb();try{assertRateLimit(request,"reset-password",5,15*60_000);const value=schema.parse(await request.json()),hash=createHash("sha256").update(value.token).digest("hex");const record=db.prepare("SELECT id,customer_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP").get(hash) as {id:number;customer_id:number}|undefined;if(!record)throw new Error("BAD_REQUEST:Link inválido ou expirado");db.exec("BEGIN IMMEDIATE");db.prepare("UPDATE customers SET password_hash=? WHERE id=?").run(hashPassword(value.password),record.customer_id);db.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(record.id);db.prepare("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE customer_id=?").run(record.customer_id);db.exec("COMMIT");return ok({reset:true});}catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}}
