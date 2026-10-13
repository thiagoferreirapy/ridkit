import { apiError } from "@/lib/api";
import { clearAuthCookies } from "@/lib/auth";
import { confirmEmailChange } from "@/lib/email-verification";
import { appUrl } from "@/lib/env";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime="nodejs";
export async function GET(request:Request){
  try{
    assertRateLimit(request,"confirm-email-change",20);
    const token=new URL(request.url).searchParams.get("token")||"",changed=token?confirmEmailChange(token):null;
    // Every session was revoked with the swap, so the customer signs in again with the new address.
    if(changed)await clearAuthCookies();
    return Response.redirect(new URL(changed?"/login?verified=1":"/login?verification=invalid",appUrl(request)),303);
  }catch(error){return apiError(error);}
}
