import { z } from "zod";
import { apiError,ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { assertRateLimit } from "@/lib/rate-limit";

export async function POST(request:Request){try{assertRateLimit(request,"newsletter",5,10*60_000);const {email}=z.object({email:z.string().trim().toLowerCase().email()}).parse(await request.json());getDb().prepare("INSERT INTO newsletter_subscribers(email,active) VALUES(?,1) ON CONFLICT(email) DO UPDATE SET active=1").run(email);await sendEmail({to:email,subject:"Bem-vindo à Ridekit",html:"<h2>Você entrou para a lista Ridekit.</h2><p>Enviaremos novidades e ofertas sem excesso de mensagens.</p>"});return ok({subscribed:true});}catch(error){return apiError(error);}}
