import { apiError,ok } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

export async function GET(){try{await requireAdmin();const db=getDb();return ok({emails:db.prepare("SELECT id,recipient,subject,status,provider_id,error,created_at FROM email_outbox ORDER BY id DESC LIMIT 100").all(),activities:db.prepare("SELECT l.id,l.action,l.resource,l.resource_id,l.details,l.created_at,a.name admin FROM admin_audit_logs l LEFT JOIN admin_users a ON a.id=l.admin_id ORDER BY l.id DESC LIMIT 100").all()});}catch(error){return apiError(error);}}
