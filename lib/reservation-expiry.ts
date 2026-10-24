import type { DatabaseSync } from "node:sqlite";
import { cancelAsaasPayment } from "./asaas.ts";
import { getDb } from "./db.ts";
import { logger } from "./logger.ts";
import { expireReservations } from "./order-state.ts";

const MAX_CANCEL_ATTEMPTS=10;

export async function expireOrphanReservations(adminId?:number){
  try{
    const count=expireReservations(getDb(),adminId);
    if(count)logger.info("reservations.expired",{count,admin_id:adminId??null});
    await cancelProviderCharges();
    return count;
  }catch(error){logger.error("reservations.expiry_failed",error);throw error}
}

// Expired or cancelled orders keep a payable Pix QR at Asaas until the charge is deleted there.
// Runs after the expiry transaction (never inside one) and retries failures on the next scheduler runs.
export async function cancelProviderCharges(db:DatabaseSync=getDb(),cancel=cancelAsaasPayment){
  if(!process.env.ASAAS_API_KEY)return 0;
  const due=db.prepare("SELECT id,provider_payment_id,provider_cancel_attempts FROM orders WHERE status='cancelled' AND payment_status NOT IN ('approved','refunded') AND payment_provider='asaas' AND provider_payment_id IS NOT NULL AND provider_cancelled_at IS NULL AND provider_cancel_attempts<? ORDER BY id LIMIT 20").all(MAX_CANCEL_ATTEMPTS) as {id:number;provider_payment_id:string;provider_cancel_attempts:number}[];
  let cancelled=0;
  for(const order of due){
    try{
      const result=await cancel(order.provider_payment_id);
      const done=db.prepare("UPDATE orders SET provider_cancelled_at=CURRENT_TIMESTAMP,provider_cancel_error=NULL WHERE id=? AND provider_cancelled_at IS NULL").run(order.id);
      // "paid": the money arrived before the delete; the webhook moves the order on its own.
      if(done.changes&&result==="deleted"){cancelled++;db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'cancelled','Cobrança Pix cancelada','O QR Code deste pedido deixou de aceitar pagamento.')").run(order.id);}
    }catch(error){
      const attempts=order.provider_cancel_attempts+1,message=(error instanceof Error?error.message:String(error)).replace(/^[A-Z_]+:/,"").slice(0,300);
      db.prepare("UPDATE orders SET provider_cancel_attempts=?,provider_cancel_error=? WHERE id=?").run(attempts,message,order.id);
      if(attempts>=MAX_CANCEL_ATTEMPTS)db.prepare("UPDATE orders SET attention_reason=? WHERE id=? AND attention_reason IS NULL").run(`Não foi possível cancelar a cobrança Pix no Asaas (${message}). Remova a cobrança pelo painel do Asaas.`,order.id);
      logger.error("payments.cancel_failed",error,{order_id:order.id,attempt:attempts});
    }
  }
  if(cancelled)logger.info("payments.cancelled",{count:cancelled});
  return cancelled;
}
