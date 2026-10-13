import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { expireReservations } from "@/lib/order-state";

export function expireOrphanReservations(adminId?:number){
  try{
    const count=expireReservations(getDb(),adminId);
    if(count)logger.info("reservations.expired",{count,admin_id:adminId??null});
    return count;
  }catch(error){logger.error("reservations.expiry_failed",error);throw error}
}
