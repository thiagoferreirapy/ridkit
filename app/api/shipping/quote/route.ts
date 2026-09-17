import { z } from "zod";
import { apiError,ok } from "@/lib/api";
import { lookupCep } from "@/lib/cep";
import { assertRateLimit } from "@/lib/rate-limit";
import { calculateShipping } from "@/lib/shipping";

export const runtime="nodejs";

export async function GET(request:Request){try{
  assertRateLimit(request,"shipping-quote",30);
  const url=new URL(request.url),cep=z.string().regex(/^\d{8}$/).parse((url.searchParams.get("cep")||"").replace(/\D/g,"")),subtotal=z.coerce.number().int().nonnegative().default(0).parse(url.searchParams.get("subtotal")||0),method=z.enum(["standard","express"]).default("standard").parse(url.searchParams.get("method")||"standard"),address=await lookupCep(cep),quote=calculateShipping(subtotal,address,method);
  return ok({address,...quote});
}catch(error){return apiError(error);}}
