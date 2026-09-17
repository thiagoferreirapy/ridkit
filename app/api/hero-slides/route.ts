import { getDb } from "@/lib/db";import { apiError,ok } from "@/lib/api";
export const runtime="nodejs";
export async function GET(){try{return ok({items:getDb().prepare("SELECT id,badge,title,description,image_url,mobile_image_url,cta_label,cta_url,secondary_label,secondary_url,sort_order FROM hero_slides WHERE active=1 ORDER BY sort_order,id LIMIT 10").all()});}catch(error){return apiError(error);}}
