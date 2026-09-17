import { apiError } from "@/lib/api";
import { verifyEmail } from "@/lib/email-verification";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime="nodejs";
export async function GET(request:Request){try{assertRateLimit(request,"verify-email",20);const url=new URL(request.url),token=url.searchParams.get("token")||"",user=token?await verifyEmail(token):null,target=new URL(user?"/login?verified=1":"/login?verification=invalid",process.env.APP_URL||url.origin);return Response.redirect(target,303);}catch(error){return apiError(error);}}
