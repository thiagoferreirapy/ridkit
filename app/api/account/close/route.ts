import { randomBytes } from "node:crypto";
import { z } from "zod";
import { apiError,ok } from "@/lib/api";
import { clearAuthCookies,requireUser,verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime="nodejs";
const schema=z.object({password:z.string().min(1).max(128),confirmation:z.literal("ENCERRAR MINHA CONTA"),session_id:z.string().min(6).max(120).optional()});

export async function POST(request:Request){
  const db=getDb();
  try{
    assertRateLimit(request,"account-close",5,60*60_000);
    const user=await requireUser(),value=schema.parse(await request.json());
    db.exec("BEGIN IMMEDIATE");
    const customer=db.prepare("SELECT password_hash,closed_at FROM customers WHERE id=?").get(user.id) as {password_hash:string|null;closed_at:string|null}|undefined;
    if(!customer||customer.closed_at)throw new Error("UNAUTHORIZED");
    if(!customer.password_hash||!verifyPassword(value.password,customer.password_hash))throw new Error("BAD_REQUEST:Senha incorreta. Confira e tente novamente.");
    const open=(db.prepare("SELECT COUNT(*) total FROM orders WHERE customer_id=? AND status IN ('pending','paid','preparing','shipped')").get(user.id) as {total:number}).total;
    if(open)throw new Error("CONFLICT:Há pedidos em andamento. Aguarde a conclusão ou fale com o suporte antes de encerrar a conta.");
    const protocol=`RK-ENC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    db.prepare("UPDATE customers SET closed_at=CURRENT_TIMESTAMP,password_hash=NULL WHERE id=?").run(user.id);
    db.prepare("INSERT INTO account_closures(customer_id,protocol) VALUES(?,?)").run(user.id,protocol);
    db.prepare("DELETE FROM refresh_tokens WHERE customer_id=?").run(user.id);
    db.prepare("DELETE FROM password_reset_tokens WHERE customer_id=?").run(user.id);
    db.prepare("DELETE FROM email_verification_tokens WHERE customer_id=?").run(user.id);
    db.prepare("DELETE FROM addresses WHERE customer_id=?").run(user.id);
    db.prepare("DELETE FROM carts WHERE customer_id=?").run(user.id);
    db.prepare("UPDATE newsletter_subscribers SET active=0 WHERE lower(email)=lower(?)").run(user.email);
    if(value.session_id){
      db.prepare("DELETE FROM carts WHERE session_id=?").run(value.session_id);
      db.prepare("DELETE FROM favorite_items WHERE session_id=?").run(value.session_id);
      db.prepare("DELETE FROM search_history WHERE session_id=?").run(value.session_id);
    }
    db.exec("COMMIT");
    await clearAuthCookies();
    logger.info("account.closed",{customer_id:user.id,protocol});
    return ok({protocol,message:"Conta encerrada. Pedidos concluídos e registros necessários permanecem protegidos conforme as obrigações aplicáveis."});
  }catch(error){if(db.isTransaction)db.exec("ROLLBACK");return apiError(error);}
}
