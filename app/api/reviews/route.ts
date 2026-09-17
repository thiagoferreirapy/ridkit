import { z } from "zod";
import { apiError,created } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRateLimit } from "@/lib/rate-limit";

const schema=z.object({product_id:z.coerce.number().int().positive(),rating:z.coerce.number().int().min(1).max(5),title:z.string().trim().max(100).optional(),comment:z.string().trim().min(10).max(1500)});
export async function POST(request:Request){try{assertRateLimit(request,"review",5,60*60_000);const user=await requireUser(),value=schema.parse(await request.json()),db=getDb();const purchase=db.prepare("SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.customer_id=? AND oi.product_id=? AND o.status IN ('paid','preparing','shipped','delivered') ORDER BY o.id DESC LIMIT 1").get(user.id,value.product_id) as {id:number}|undefined;if(!purchase)throw new Error("FORBIDDEN_REVIEW");const result=db.prepare("INSERT INTO reviews(product_id,customer_id,order_id,rating,title,comment,verified,approved) VALUES(?,?,?,?,?,?,1,0)").run(value.product_id,user.id,purchase.id,value.rating,value.title||null,value.comment);return created({id:Number(result.lastInsertRowid),message:"Avaliação enviada para moderação"});}catch(error){if(error instanceof Error&&error.message==="FORBIDDEN_REVIEW")return Response.json({error:"A avaliação exige uma compra confirmada deste produto"},{status:403});if(error instanceof Error&&/UNIQUE/.test(error.message))return apiError(new Error("CONFLICT:Você já avaliou este produto"));return apiError(error);}}
