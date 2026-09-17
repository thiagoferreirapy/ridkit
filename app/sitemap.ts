import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";

export default function sitemap():MetadataRoute.Sitemap{
  const base=process.env.APP_URL||"http://localhost:3000",now=new Date();
  const paths=["","/capacetes","/ofertas","/marcas","/sobre","/contato","/entrega","/garantia","/privacidade","/termos","/guia-de-tamanho","/ajuda"];
  const products=getDb().prepare("SELECT slug,updated_at FROM products WHERE active=1").all() as {slug:string;updated_at:string}[];
  return [...paths.map(path=>({url:`${base}${path}`,lastModified:now,changeFrequency:path?"weekly" as const:"daily" as const,priority:path?0.7:1})),...products.map(product=>({url:`${base}/produto/${product.slug}`,lastModified:new Date(product.updated_at),changeFrequency:"weekly" as const,priority:0.8}))];
}
