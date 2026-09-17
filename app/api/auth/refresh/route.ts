import { apiError, ok } from "@/lib/api";
import { REFRESH_COOKIE, clearAuthCookies, requestMeta, rotateRefreshToken, setAuthCookies } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { cookies } from "next/headers";
export const runtime="nodejs";
export async function POST(request:Request){try{const token=(await cookies()).get(REFRESH_COOKIE)?.value;if(!token)throw new Error("UNAUTHORIZED");const rotated=rotateRefreshToken(token,requestMeta(request));if(!rotated){await clearAuthCookies();throw new Error("UNAUTHORIZED");}const user=getDb().prepare("SELECT id,name,email FROM customers WHERE id=?").get(rotated.customerId) as {id:number;name:string;email:string}|undefined;if(!user)throw new Error("UNAUTHORIZED");await setAuthCookies(user,rotated);return ok({user});}catch(error){return apiError(error);}}
