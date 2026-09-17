import { apiError,ok } from "@/lib/api";
import { assertRateLimit } from "@/lib/rate-limit";
import { lookupCep } from "@/lib/cep";

export async function GET(request:Request,{params}:{params:Promise<{cep:string}>}){try{assertRateLimit(request,"cep",30);return ok(await lookupCep((await params).cep));}catch(error){return apiError(error);}}
