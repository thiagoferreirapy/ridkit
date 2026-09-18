import { getDb } from "@/lib/db";
import { apiError,ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/admin-auth";

export const runtime="nodejs";
export async function GET(){
  try{
    await requireAdminPermission("dashboard.view");const db=getDb();
    const metrics=db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_cents ELSE 0 END),0) revenue_cents,
      COUNT(*) orders,
      COALESCE(AVG(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_cents END),0) average_ticket_cents,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending_orders,
      SUM(CASE WHEN status='shipped' THEN 1 ELSE 0 END) shipped_orders,
      SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered_orders,
      SUM(CASE WHEN payment_status='approved' THEN 1 ELSE 0 END) approved_payments
      FROM orders`).get() as Record<string,number>;
    const cost=(db.prepare(`SELECT COALESCE(SUM(oi.quantity*p.cost_cents),0) value FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE o.status NOT IN ('cancelled','refunded')`).get() as {value:number}).value;
    return ok({metrics:{...metrics,cost_cents:cost,margin_cents:metrics.revenue_cents-cost,approval_rate:metrics.orders?Math.round(metrics.approved_payments/metrics.orders*100):0},
      revenue_series:db.prepare(`SELECT strftime('%d/%m',created_at) label,date(created_at) day,SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total_cents ELSE 0 END) revenue_cents,COUNT(*) orders FROM orders WHERE date(created_at)>=date('now','-29 days') GROUP BY date(created_at) ORDER BY day`).all(),
      margin_series:db.prepare(`SELECT strftime('%d/%m',o.created_at) label,date(o.created_at) day,SUM(CASE WHEN o.status NOT IN ('cancelled','refunded') THEN oi.total_cents ELSE 0 END) revenue_cents,SUM(CASE WHEN o.status NOT IN ('cancelled','refunded') THEN oi.quantity*p.cost_cents ELSE 0 END) cost_cents,SUM(CASE WHEN o.status NOT IN ('cancelled','refunded') THEN oi.total_cents-oi.quantity*p.cost_cents ELSE 0 END) margin_cents FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN products p ON p.id=oi.product_id WHERE date(o.created_at)>=date('now','-29 days') GROUP BY date(o.created_at) ORDER BY day`).all(),
      customer_series:db.prepare(`SELECT strftime('%d/%m',created_at) label,date(created_at) day,COUNT(*) customers FROM customers WHERE date(created_at)>=date('now','-29 days') GROUP BY date(created_at) ORDER BY day`).all(),
      low_stock:db.prepare(`SELECT p.id,p.name,p.sku,b.name brand,SUM(v.stock-v.reserved_stock) available FROM products p JOIN brands b ON b.id=p.brand_id JOIN product_variants v ON v.product_id=p.id WHERE p.active=1 GROUP BY p.id HAVING available<10 ORDER BY available ASC LIMIT 10`).all(),
      status_breakdown:db.prepare("SELECT status,COUNT(*) count,SUM(total_cents) total_cents FROM orders GROUP BY status ORDER BY count DESC").all(),
      payment_breakdown:db.prepare("SELECT payment_status status,COUNT(*) count,COALESCE(SUM(total_cents),0) total_cents FROM orders GROUP BY payment_status ORDER BY count DESC").all(),
      category_sales:db.prepare(`SELECT c.name category,COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END),0) units,COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.total_cents ELSE 0 END),0) revenue_cents FROM categories c LEFT JOIN products p ON p.category_id=c.id LEFT JOIN order_items oi ON oi.product_id=p.id LEFT JOIN orders o ON o.id=oi.order_id AND o.status NOT IN ('cancelled','refunded') GROUP BY c.id HAVING units>0 ORDER BY revenue_cents DESC LIMIT 8`).all(),
      recent_orders:db.prepare("SELECT o.id,o.order_number,o.status,o.total_cents,o.payment_method,o.created_at,c.name customer FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 8").all(),
      top_products:db.prepare("SELECT p.id,p.name,b.name brand,SUM(oi.quantity) units,SUM(oi.total_cents) revenue_cents FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN brands b ON b.id=p.brand_id JOIN orders o ON o.id=oi.order_id WHERE o.status NOT IN ('cancelled','refunded') GROUP BY p.id ORDER BY units DESC LIMIT 6").all(),
      inventory:db.prepare("SELECT COUNT(DISTINCT p.id) products,COALESCE(SUM(v.stock-v.reserved_stock),0) units,COALESCE(SUM(v.reserved_stock),0) reserved_units,SUM(CASE WHEN v.stock-v.reserved_stock<=v.min_stock THEN 1 ELSE 0 END) critical_variants FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.active=1 AND v.active=1").get(),
      operations:db.prepare(`SELECT (SELECT COUNT(*) FROM customers) customers,(SELECT COUNT(*) FROM customers WHERE date(created_at)=date('now')) new_customers_today,(SELECT COUNT(*) FROM contact_messages WHERE status='new') new_messages,(SELECT COUNT(*) FROM whatsapp_requests WHERE status='new') new_whatsapp_requests,(SELECT COUNT(*) FROM newsletter_subscribers WHERE active=1) subscribers,(SELECT COUNT(*) FROM reviews WHERE approved=0) pending_reviews,(SELECT COUNT(*) FROM email_outbox WHERE status='failed') failed_emails,(SELECT COUNT(*) FROM orders WHERE date(created_at)=date('now')) orders_today,(SELECT COALESCE(SUM(total_cents),0) FROM orders WHERE date(created_at)=date('now') AND status NOT IN ('cancelled','refunded')) revenue_today`).get(),
      recent_contacts:db.prepare("SELECT id,name,email,subject,status,created_at FROM contact_messages ORDER BY id DESC LIMIT 5").all(),
      recent_activity:db.prepare("SELECT l.id,l.action,l.resource,l.resource_id,l.created_at,a.name admin FROM admin_audit_logs l LEFT JOIN admin_users a ON a.id=l.admin_id ORDER BY l.id DESC LIMIT 6").all()
    });
  }catch(error){return apiError(error)}
}
