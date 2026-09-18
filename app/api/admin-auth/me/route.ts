import { adminById,requireAdmin } from "@/lib/admin-auth";
import { apiError,ok } from "@/lib/api";
export const runtime="nodejs";
export async function GET(){try{const session=await requireAdmin(),user=adminById(session.id);if(!user)throw new Error("UNAUTHORIZED");return ok({user});}catch(error){return apiError(error);}}
