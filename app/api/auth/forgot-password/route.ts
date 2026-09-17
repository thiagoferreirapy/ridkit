import { createHash,randomBytes } from "node:crypto";
import { z } from "zod";
import { apiError,ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request:Request){try{assertRateLimit(request,"forgot-password",3,15*60_000);const {email}=z.object({email:z.string().trim().toLowerCase().email()}).parse(await request.json());const customer=getDb().prepare("SELECT id,name,email FROM customers WHERE lower(email)=?").get(email) as {id:number;name:string;email:string}|undefined;if(customer){const token=randomBytes(32).toString("base64url"),hash=createHash("sha256").update(token).digest("hex"),expires=new Date(Date.now()+30*60_000).toISOString();getDb().prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE customer_id=? AND used_at IS NULL").run(customer.id);getDb().prepare("INSERT INTO password_reset_tokens(customer_id,token_hash,expires_at) VALUES(?,?,?)").run(customer.id,hash,expires);const origin=process.env.APP_URL||new URL(request.url).origin;await sendEmail({to:customer.email,subject:"Redefina sua senha da Ridekit",html:`<h2>Redefinição de senha</h2><p>Olá, ${customer.name}.</p><p><a href="${origin}/redefinir-senha?token=${encodeURIComponent(token)}">Criar nova senha</a></p><p>O link expira em 30 minutos.</p>`});}return ok({message:"Se o e-mail estiver cadastrado, enviaremos as instruções."});}catch(error){return apiError(error);}}
