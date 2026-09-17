import { z } from "zod";
import { apiError,ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email-verification";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime="nodejs";
export async function POST(request:Request){try{assertRateLimit(request,"resend-verification",3,15*60_000);const {email}=z.object({email:z.string().trim().toLowerCase().email()}).parse(await request.json()),customer=getDb().prepare("SELECT id,name,email,email_verified_at FROM customers WHERE lower(email)=?").get(email) as {id:number;name:string;email:string;email_verified_at:string|null}|undefined;if(customer&&!customer.email_verified_at)await sendVerificationEmail(customer,process.env.APP_URL||new URL(request.url).origin);return ok({message:"Se o cadastro estiver pendente, enviaremos um novo link."});}catch(error){return apiError(error);}}
