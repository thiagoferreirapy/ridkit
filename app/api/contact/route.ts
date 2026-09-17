import { z } from "zod";
import { apiError,created } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { assertRateLimit } from "@/lib/rate-limit";

const schema=z.object({name:z.string().trim().min(2).max(80),email:z.string().trim().toLowerCase().email(),subject:z.string().trim().min(3).max(120),message:z.string().trim().min(10).max(3000)});
export async function POST(request:Request){try{assertRateLimit(request,"contact",5,10*60_000);const value=schema.parse(await request.json());const result=getDb().prepare("INSERT INTO contact_messages(name,email,subject,message) VALUES(?,?,?,?)").run(value.name,value.email,value.subject,value.message);await sendEmail({to:process.env.CONTACT_EMAIL||"ajuda@ridekit.com.br",subject:`Contato Ridekit: ${value.subject}`,html:`<h2>Novo contato</h2><p><strong>${escapeHtml(value.name)}</strong> (${escapeHtml(value.email)})</p><p>${escapeHtml(value.message).replace(/\n/g,"<br>")}</p>`});return created({id:Number(result.lastInsertRowid),message:"Mensagem recebida"});}catch(error){return apiError(error);}}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]!));}
