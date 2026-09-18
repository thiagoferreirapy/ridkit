import { apiError,ok } from "@/lib/api";
import { requireAdminPermission } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { expireOrphanReservations } from "@/lib/reservation-expiry";

export const runtime="nodejs";
export async function POST(){try{const admin=await requireAdminPermission("inventory.manage"),count=expireOrphanReservations(admin.id);audit(admin.id,"expire_reservations","orders",undefined,{orders:count});return ok({expired_orders:count});}catch(error){return apiError(error)}}
