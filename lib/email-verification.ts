import { createHash,randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getStoreSettings } from "@/lib/store-settings";

const tokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char));
const shell=(content:string)=>`<div style="margin:0;background:#f4f5f7;padding:32px 16px;font-family:Arial,sans-serif;color:#15171a"><div style="max-width:600px;margin:auto;overflow:hidden;border-radius:20px;background:#fff;box-shadow:0 12px 40px rgba(11,13,16,.08)"><div style="height:5px;background:#ff4d00"></div><div style="padding:32px"><div style="font-size:22px;font-weight:800;letter-spacing:-.5px">RIDEKIT</div>${content}</div><div style="padding:18px 32px;background:#0b0d10;color:#aeb4bd;font-size:12px;line-height:18px">Ridekit · Equipado para qualquer caminho<br>Se você não iniciou esta ação, ignore este e-mail.</div></div></div>`;

export async function sendVerificationEmail(customer:{id:number;name:string;email:string},origin:string){
  const db=getDb(),token=randomBytes(32).toString("base64url"),expires=new Date(Date.now()+24*60*60_000).toISOString();
  db.prepare("UPDATE email_verification_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP) WHERE customer_id=? AND used_at IS NULL").run(customer.id);
  db.prepare("INSERT INTO email_verification_tokens(customer_id,token_hash,expires_at) VALUES(?,?,?)").run(customer.id,tokenHash(token),expires);
  const link=`${origin.replace(/\/$/,"")}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({to:customer.email,subject:"Confirme seu e-mail na Ridekit",html:shell(`<p style="margin:28px 0 8px;font-size:13px;font-weight:700;color:#ff4d00;text-transform:uppercase;letter-spacing:1.5px">Confirmação de cadastro</p><h1 style="margin:0;font-size:28px;line-height:36px">Olá, ${escapeHtml(customer.name)}.</h1><p style="margin:16px 0;color:#626975;font-size:15px;line-height:24px">Confirme seu endereço de e-mail para proteger sua conta e liberar o acesso completo à Ridekit.</p><a href="${link}" style="display:inline-block;margin:8px 0 20px;padding:14px 22px;border-radius:10px;background:#ff4d00;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Confirmar meu e-mail</a><p style="margin:0;color:#8a9099;font-size:12px;line-height:19px">Este link é válido por 24 horas. Se o botão não abrir, copie:<br><span style="word-break:break-all">${link}</span></p>`)});
}

export async function verifyEmail(token:string){
  const db=getDb(),record=db.prepare(`SELECT t.id,t.customer_id,t.expires_at,t.used_at,c.name,c.email,c.email_verified_at FROM email_verification_tokens t JOIN customers c ON c.id=t.customer_id WHERE t.token_hash=?`).get(tokenHash(token)) as {id:number;customer_id:number;expires_at:string;used_at:string|null;name:string;email:string;email_verified_at:string|null}|undefined;
  if(!record||record.used_at||new Date(record.expires_at)<=new Date())return null;
  db.exec("BEGIN IMMEDIATE");try{db.prepare("UPDATE email_verification_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(record.id);db.prepare("UPDATE customers SET email_verified_at=CURRENT_TIMESTAMP WHERE id=?").run(record.customer_id);db.exec("COMMIT");}catch(error){if(db.isTransaction)db.exec("ROLLBACK");throw error;}
  const settings=getStoreSettings(),homeUrl=(process.env.APP_URL||"http://localhost:3000").replace(/\/$/,""),replace=(template:string,html=false)=>template.replaceAll("{{name}}",html?escapeHtml(record.name):record.name).replaceAll("{{store_name}}",html?escapeHtml(settings.store_name):settings.store_name).replaceAll("{{home_url}}",homeUrl);
  await sendEmail({to:record.email,subject:replace(settings.welcome_email_subject),html:shell(replace(settings.welcome_email_html,true))});
  return {id:record.customer_id,name:record.name,email:record.email};
}
