import { z } from "zod";
import { apiError, ok } from "@/lib/api";
import { createRefreshToken, requestMeta, setAuthCookies, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRateLimit } from "@/lib/rate-limit";
export const runtime="nodejs";
const schema=z.object({email:z.string().trim().toLowerCase().email(),password:z.string().min(1).max(128)});
export async function POST(request:Request){try{assertRateLimit(request,"customer-login",8,10*60_000);const value=schema.parse(await request.json());const customer=getDb().prepare("SELECT id,name,email,password_hash,email_verified_at FROM customers WHERE lower(email)=?").get(value.email) as {id:number;name:string;email:string;password_hash?:string;email_verified_at:string|null}|undefined;if(!customer?.password_hash||!verifyPassword(value.password,customer.password_hash))return Response.json({error:"E-mail ou senha incorretos"},{status:401});if(!customer.email_verified_at)return Response.json({error:"Confirme seu e-mail antes de entrar",code:"EMAIL_NOT_VERIFIED"},{status:403});const user={id:customer.id,name:customer.name,email:customer.email};const refresh=createRefreshToken(user.id,requestMeta(request));await setAuthCookies(user,refresh);return ok({user});}catch(error){return apiError(error);}}
