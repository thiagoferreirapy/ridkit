import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { apiError,created,ok,pagination } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRateLimit } from "@/lib/rate-limit";
import { calculateShipping } from "@/lib/shipping";
import { getStoreSettings } from "@/lib/store-settings";

export const runtime="nodejs";
const createSchema=z.object({session_id:z.string().min(6).max(120),notes:z.string().trim().max(500).optional()});
const money=(value:number)=>(value/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export async function POST(request:Request){try{
  assertRateLimit(request,"whatsapp-checkout",6,10*60_000);
  const user=await requireUser(),value=createSchema.parse(await request.json()),settings=getStoreSettings();
  if(settings.purchase_mode!=="whatsapp")throw new Error("BAD_REQUEST:A loja não está aceitando pedidos pelo WhatsApp neste momento");
  if(settings.whatsapp_number==="5511999999999")throw new Error("BAD_REQUEST:Configure o número real do WhatsApp da loja no painel administrativo");
  const db=getDb(),customer=db.prepare("SELECT id,name,email,phone FROM customers WHERE id=?").get(user.id) as {id:number;name:string;email:string;phone:string|null}|undefined,address=db.prepare("SELECT zip_code,street,number,complement,district,city,state FROM addresses WHERE customer_id=? ORDER BY is_default DESC,id LIMIT 1").get(user.id) as {zip_code:string;street:string;number:string;complement:string|null;district:string;city:string;state:string}|undefined;
  if(!customer)throw new Error("UNAUTHORIZED");
  if(!address)throw new Error("BAD_REQUEST:Cadastre um endereço de entrega na sua conta antes de finalizar pelo WhatsApp");
  const cart=db.prepare("SELECT id FROM carts WHERE session_id=?").get(value.session_id) as {id:number}|undefined;
  if(!cart)throw new Error("BAD_REQUEST:Carrinho vazio");
  const items=db.prepare(`SELECT p.name,b.name brand,p.slug,v.sku,v.size,v.color,ci.quantity,COALESCE(v.price_cents,p.price_cents) unit_price_cents,COALESCE(v.price_cents,p.price_cents)*ci.quantity total_cents FROM cart_items ci JOIN product_variants v ON v.id=ci.variant_id JOIN products p ON p.id=v.product_id JOIN brands b ON b.id=p.brand_id WHERE ci.cart_id=? ORDER BY ci.id`).all(cart.id) as {name:string;brand:string;slug:string;sku:string;size:string;color:string;quantity:number;unit_price_cents:number;total_cents:number}[];
  if(!items.length)throw new Error("BAD_REQUEST:Carrinho vazio");
  const subtotal=items.reduce((sum,item)=>sum+item.total_cents,0),quote=calculateShipping(subtotal,address,"standard"),shipping=quote.shipping_cents,total=subtotal+shipping,requestNumber=`WA-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`,origin=(process.env.APP_URL||new URL(request.url).origin).replace(/\/$/,"");
  const fullAddress=`${address.street}, ${address.number}${address.complement?` · ${address.complement}`:""} · ${address.district} · ${address.city}/${address.state} · CEP ${address.zip_code}`;
  const lines=[settings.whatsapp_message_intro,"",`*Solicitação ${requestNumber}*`,`Cliente: ${customer.name}`,customer.phone?`Telefone: ${customer.phone}`:"",`E-mail: ${customer.email}`,`Entrega: ${fullAddress}`,"","*Itens:*",...items.flatMap((item,index)=>[`${index+1}. ${item.brand} ${item.name}`,`   ${item.color} · ${item.size} · SKU ${item.sku}`,`   ${item.quantity} x ${money(item.unit_price_cents)} = ${money(item.total_cents)}`,`   ${origin}/produto/${item.slug}`]),"",`Subtotal: ${money(subtotal)}`,`Frete estimado: ${shipping?money(shipping):"Grátis"}`,quote.rule?`Promoção aplicada: ${quote.rule.name}`:"",`*Total estimado: ${money(total)}*`,value.notes?`Observações: ${value.notes}`:"","Valores e disponibilidade serão confirmados no atendimento."].filter(Boolean),message=lines.join("\n"),snapshot={items,address,customer:{id:customer.id,name:customer.name,email:customer.email,phone:customer.phone},shipping_rule:quote.rule};
  const result=db.prepare("INSERT INTO whatsapp_requests(request_number,session_id,customer_name,customer_phone,customer_email,customer_zip_code,shipping_rule_id,shipping_rule_name,notes,subtotal_cents,shipping_cents,total_cents,items_count,snapshot_json,message) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(requestNumber,value.session_id,customer.name,customer.phone,customer.email,address.zip_code,quote.rule?.id||null,quote.rule?.name||null,value.notes||null,subtotal,shipping,total,items.reduce((sum,item)=>sum+item.quantity,0),JSON.stringify(snapshot),message);
  return created({id:Number(result.lastInsertRowid),request_number:requestNumber,whatsapp_url:`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(message)}`,message,shipping_cents:shipping,shipping_rule:quote.rule,total_cents:total});
}catch(error){return apiError(error);}}

export async function GET(request:Request){try{await requireAdmin();const url=new URL(request.url),{page,limit,offset}=pagination(url.searchParams),status=url.searchParams.get("status"),db=getDb(),where=status?"WHERE status=?":"",params=status?[status]:[],total=(db.prepare(`SELECT COUNT(*) count FROM whatsapp_requests ${where}`).get(...params) as {count:number}).count,items=db.prepare(`SELECT id,request_number,customer_name,customer_phone,customer_email,customer_zip_code,shipping_rule_name,subtotal_cents,shipping_cents,total_cents,items_count,status,created_at,updated_at FROM whatsapp_requests ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params,limit,offset);return ok({items,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});}catch(error){return apiError(error);}}

export async function PATCH(request:Request){try{const admin=await requireAdmin(["admin","manager","support"]),value=z.object({id:z.coerce.number().int().positive(),status:z.enum(["new","contacted","converted","cancelled"])}).parse(await request.json()),result=getDb().prepare("UPDATE whatsapp_requests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(value.status,value.id);if(!result.changes)throw new Error("NOT_FOUND");audit(admin.id,"status_update","whatsapp_requests",value.id,{status:value.status});return ok({id:value.id,status:value.status});}catch(error){return apiError(error);}}
