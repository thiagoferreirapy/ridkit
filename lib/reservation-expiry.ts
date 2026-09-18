import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export function expireOrphanReservations(adminId?:number){
  const db=getDb(),orders=db.prepare("SELECT id,coupon_id FROM orders WHERE status='pending' AND payment_status='pending' AND pix_expires_at IS NOT NULL AND datetime(pix_expires_at)<=CURRENT_TIMESTAMP").all() as {id:number;coupon_id:number|null}[];
  if(!orders.length)return 0;
  db.exec("BEGIN IMMEDIATE");
  try{
    for(const order of orders){
      const items=db.prepare("SELECT variant_id,quantity FROM order_items WHERE order_id=?").all(order.id) as {variant_id:number;quantity:number}[];
      for(const item of items){
        db.prepare("UPDATE product_variants SET reserved_stock=MAX(0,reserved_stock-?) WHERE id=?").run(item.quantity,item.variant_id);
        const state=db.prepare("SELECT stock,reserved_stock FROM product_variants WHERE id=?").get(item.variant_id) as {stock:number;reserved_stock:number};
        db.prepare("INSERT INTO inventory_movements(variant_id,order_id,admin_id,movement_type,quantity,stock_after,reserved_after,reason) VALUES(?,?,?,'release',?,?,?,?)").run(item.variant_id,order.id,adminId??null,-item.quantity,state.stock,state.reserved_stock,"Liberação automática de reserva expirada");
      }
      db.prepare("UPDATE orders SET status='cancelled',payment_status='failed',payment_updated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
      db.prepare("INSERT INTO order_events(order_id,status,title,description) VALUES(?,'cancelled','Reserva expirada','Reserva liberada pela rotina automática de segurança.')").run(order.id);
      if(order.coupon_id)db.prepare("UPDATE coupons SET used_count=MAX(0,used_count-1) WHERE id=?").run(order.coupon_id);
    }
    db.exec("COMMIT");logger.info("reservations.expired",{count:orders.length,admin_id:adminId??null});return orders.length;
  }catch(error){if(db.isTransaction)db.exec("ROLLBACK");logger.error("reservations.expiry_failed",error);throw error}
}
