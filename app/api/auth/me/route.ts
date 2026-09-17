import { apiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){try{return ok({user:await requireUser()});}catch(error){return apiError(error);}}
