import { databasePath, getDb } from "@/lib/db";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export function GET() {
  const result=getDb().prepare("SELECT sqlite_version() AS sqlite_version,(SELECT COUNT(*) FROM products) AS products,(SELECT COUNT(*) FROM orders) AS orders").get();
  return ok({status:"healthy",service:"ridekit-api",runtime:process.version,database:databasePath,...result as object,timestamp:new Date().toISOString()});
}
