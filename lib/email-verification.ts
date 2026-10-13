import { escapeHtml } from "@/lib/html";
import { appUrl } from "@/lib/env";
import { createHash,randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getStoreSettings } from "@/lib/store-settings";

const tokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
const shell=(content:string)=>`<div style="margin:0;background:#f5f5f5;padding:32px 16px;font-family:Arial,sans-serif;color:#1f1f1f"><div style="max-width:600px;margin:auto;overflow:hidden;border-radius:8px;border:1px solid #e0e0e0;background:#fff"><div style="height:4px;background:#f28000"></div><div style="padding:32px"><div style="font-size:22px;font-weight:800;color:#f28000">RIDEKIT</div>${content}</div><div style="padding:18px 32px;border-top:1px solid #e0e0e0;color:#6a6a6a;font-size:12px;line-height:18px">Ridekit · Capacetes e equipamentos para moto<br>Se você não iniciou esta ação, ignore este e-mail.</div></div></div>`;

export async function sendVerificationEmail(customer:{id:number;name:string;email:string},origin:string){
  const db=getDb(),token=randomBytes(32).toString("base64url"),expires=new Date(Date.now()+24*60*60_000).toISOString();
  db.prepare("UPDATE email_verification_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP) WHERE customer_id=? AND used_at IS NULL").run(customer.id);
  db.prepare("INSERT INTO email_verification_tokens(customer_id,token_hash,expires_at) VALUES(?,?,?)").run(customer.id,tokenHash(token),expires);
  const link=`${origin.replace(/\/$/,"")}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({to:customer.email,subject:"Confirme seu e-mail na Ridekit",html:shell(`<h1 style="margin:24px 0 0;font-size:24px;line-height:32px">Olá, ${escapeHtml(customer.name)}! Confirme seu e-mail.</h1><p style="margin:16px 0;color:#6a6a6a;font-size:15px;line-height:24px">Falta só confirmar seu endereço de e-mail para ativar a conta e começar a comprar.</p><a href="${link}" style="display:inline-block;margin:8px 0 20px;padding:14px 22px;border-radius:6px;background:#f28000;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Confirmar meu e-mail</a><p style="margin:0;color:#8a9099;font-size:12px;line-height:19px">Este link é válido por 24 horas. Se o botão não abrir, copie:<br><span style="word-break:break-all">${link}</span></p>`)});
}

// The new address only replaces the login e-mail after its owner clicks the link sent to it.
export async function sendEmailChangeConfirmation(customer:{id:number;name:string},newEmail:string,origin:string){
  const db=getDb(),token=randomBytes(32).toString("base64url"),expires=new Date(Date.now()+24*60*60_000).toISOString();
  db.prepare("UPDATE email_change_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP) WHERE customer_id=? AND used_at IS NULL").run(customer.id);
  db.prepare("INSERT INTO email_change_tokens(customer_id,new_email,token_hash,expires_at) VALUES(?,?,?,?)").run(customer.id,newEmail,tokenHash(token),expires);
  const link=`${origin.replace(/\/$/,"")}/api/account/confirm-email?token=${encodeURIComponent(token)}`;
  return sendEmail({to:newEmail,subject:"Confirme seu novo e-mail na Ridekit",html:shell(`<h1 style="margin:24px 0 0;font-size:24px;line-height:32px">Olá, ${escapeHtml(customer.name)}! Confirme o novo e-mail.</h1><p style="margin:16px 0;color:#6a6a6a;font-size:15px;line-height:24px">Recebemos um pedido para usar este endereço no login da sua conta. A troca só acontece depois da confirmação.</p><a href="${link}" style="display:inline-block;margin:8px 0 20px;padding:14px 22px;border-radius:6px;background:#f28000;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Confirmar novo e-mail</a><p style="margin:0;color:#8a9099;font-size:12px;line-height:19px">Este link é válido por 24 horas. Se o botão não abrir, copie:<br><span style="word-break:break-all">${link}</span></p>`)});
}

export function confirmEmailChange(token:string){
  const db=getDb(),record=db.prepare("SELECT t.id,t.customer_id,t.new_email,t.expires_at,t.used_at FROM email_change_tokens t JOIN customers c ON c.id=t.customer_id WHERE t.token_hash=? AND c.closed_at IS NULL").get(tokenHash(token)) as {id:number;customer_id:number;new_email:string;expires_at:string;used_at:string|null}|undefined;
  if(!record||record.used_at||new Date(record.expires_at)<=new Date())return null;
  db.exec("BEGIN IMMEDIATE");
  try{
    if(db.prepare("SELECT 1 FROM customers WHERE lower(email)=? AND id<>?").get(record.new_email,record.customer_id)){db.exec("ROLLBACK");return null;}
    db.prepare("UPDATE email_change_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(record.id);
    db.prepare("UPDATE customers SET email=?,email_verified_at=CURRENT_TIMESTAMP WHERE id=?").run(record.new_email,record.customer_id);
    db.prepare("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE customer_id=?").run(record.customer_id);
    db.exec("COMMIT");return {id:record.customer_id,email:record.new_email};
  }catch(error){if(db.isTransaction)db.exec("ROLLBACK");throw error;}
}

export async function verifyEmail(token:string){
  const db=getDb(),record=db.prepare(`SELECT t.id,t.customer_id,t.expires_at,t.used_at,c.name,c.email,c.email_verified_at FROM email_verification_tokens t JOIN customers c ON c.id=t.customer_id WHERE t.token_hash=?`).get(tokenHash(token)) as {id:number;customer_id:number;expires_at:string;used_at:string|null;name:string;email:string;email_verified_at:string|null}|undefined;
  if(!record||record.used_at||new Date(record.expires_at)<=new Date())return null;
  db.exec("BEGIN IMMEDIATE");try{db.prepare("UPDATE email_verification_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(record.id);db.prepare("UPDATE customers SET email_verified_at=CURRENT_TIMESTAMP WHERE id=?").run(record.customer_id);db.exec("COMMIT");}catch(error){if(db.isTransaction)db.exec("ROLLBACK");throw error;}
  const settings=getStoreSettings(),homeUrl=appUrl(),replace=(template:string,html=false)=>template.replaceAll("{{name}}",html?escapeHtml(record.name):record.name).replaceAll("{{store_name}}",html?escapeHtml(settings.store_name):settings.store_name).replaceAll("{{home_url}}",homeUrl);
  await sendEmail({to:record.email,subject:replace(settings.welcome_email_subject),html:shell(replace(settings.welcome_email_html,true))});
  return {id:record.customer_id,name:record.name,email:record.email};
}
