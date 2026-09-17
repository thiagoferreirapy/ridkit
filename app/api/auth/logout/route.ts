import { ok } from "@/lib/api";
import { REFRESH_COOKIE, clearAuthCookies, revokeRefreshToken } from "@/lib/auth";
import { cookies } from "next/headers";
export const runtime="nodejs";
export async function POST(){const token=(await cookies()).get(REFRESH_COOKIE)?.value;revokeRefreshToken(token);await clearAuthCookies();return ok({logged_out:true});}
