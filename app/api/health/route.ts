import { getDb } from "@/lib/db";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export function GET() {
  // Public endpoint: confirms the database answers without exposing paths, versions or business counts.
  getDb().prepare("SELECT 1").get();
  return ok({status:"healthy",service:"ridekit-api",timestamp:new Date().toISOString()});
}
