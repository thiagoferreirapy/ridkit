import { StorePage } from "@/components/pages";
import type { Metadata } from "next";
import { getDb } from "@/lib/db";

export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}):Promise<Metadata>{
  const {slug}=await params,path=`/${slug.join("/")}`,db=getDb();
  if(slug[0]==="produto"&&slug[1]){const product=db.prepare("SELECT name,description,seo_title,seo_description,seo_image_url,publication_status FROM products WHERE slug=?").get(slug[1]) as {name:string;description:string;seo_title:string|null;seo_description:string|null;seo_image_url:string|null;publication_status:string}|undefined;if(product){const title=product.seo_title||product.name,description=product.seo_description||product.description.slice(0,160);return {title,description,alternates:{canonical:path},robots:product.publication_status==="active"?{index:true,follow:true}:{index:false,follow:false},openGraph:{title,description,type:"website",images:product.seo_image_url?[product.seo_image_url]:undefined}};}}
  if((slug[0]==="categorias"||slug[0]==="capacetes")&&slug[1]){const category=db.prepare("SELECT name,description,seo_title,seo_description FROM categories WHERE slug=? AND active=1").get(slug[1]) as {name:string;description:string|null;seo_title:string|null;seo_description:string|null}|undefined;if(category){const title=category.seo_title||category.name,description=category.seo_description||category.description||`Produtos da categoria ${category.name}`;return {title,description,alternates:{canonical:path},openGraph:{title,description,type:"website"}};}}
  const titles:Record<string,string>={capacetes:"Produtos",ofertas:"Ofertas",lancamentos:"Lançamentos",categorias:"Categorias",marcas:"Marcas",conta:"Minha conta",checkout:"Checkout"};const title=titles[slug[0]];return title?{title,alternates:{canonical:path},robots:["conta","checkout","admin"].includes(slug[0])?{index:false,follow:false}:undefined}:{};
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <StorePage path={`/${slug.join("/")}`} />;
}
