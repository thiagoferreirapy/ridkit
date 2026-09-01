import { getDb } from "@/lib/db";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export function GET() { const db=getDb(); const metrics=db.prepare(`SELECT
  COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_cents ELSE 0 END),0) AS revenue_cents,
  COUNT(*) AS orders,
  COALESCE(AVG(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_cents END),0) AS average_ticket_cents,
  SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_orders
  FROM orders`).get(); return ok({metrics,
    low_stock:db.prepare(`SELECT p.id,p.name,p.sku,b.name AS brand,SUM(v.stock-v.reserved_stock) AS available FROM products p JOIN brands b ON b.id=p.brand_id JOIN product_variants v ON v.product_id=p.id WHERE p.active=1 GROUP BY p.id HAVING available<10 ORDER BY available ASC LIMIT 10`).all(),
    status_breakdown:db.prepare("SELECT status,COUNT(*) AS count,SUM(total_cents) AS total_cents FROM orders GROUP BY status ORDER BY count DESC").all(),
    recent_orders:db.prepare("SELECT o.id,o.order_number,o.status,o.total_cents,o.payment_method,o.created_at,c.name AS customer FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 10").all(),
    top_products:db.prepare("SELECT p.id,p.name,b.name AS brand,SUM(oi.quantity) AS units,SUM(oi.total_cents) AS revenue_cents FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN brands b ON b.id=p.brand_id GROUP BY p.id ORDER BY units DESC LIMIT 8").all(),
  }); }
