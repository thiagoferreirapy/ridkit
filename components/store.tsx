"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/components/focus-trap";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, ChevronDown, ChevronRight, Heart, Menu, Minus, Package, Search,
  ShieldCheck, ShoppingBag, SlidersHorizontal, Star, Truck, Headset, X, Plus,
} from "lucide-react";
import type { Product } from "@/lib/catalog";
import { useShop, type CartItem } from "@/components/shop-state";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

const formatMoney=(cents:number)=>(cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function Button({ children, href, variant = "primary", className = "", onClick, disabled }: {
  children: React.ReactNode; href?: string; variant?: "primary" | "dark" | "outline" | "ghost";
  className?: string; onClick?: () => void; disabled?: boolean;
}) {
  const styles = {
    primary: "bg-accent text-white hover:bg-accent-strong",
    dark: "bg-ink text-white hover:bg-[#333333]",
    outline: "border border-line bg-white text-ink hover:bg-canvas",
    ghost: "bg-transparent text-ink hover:bg-canvas",
  }[variant];
  const cls = `focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-colors ${styles} ${className}`;
  return href ? <Link href={href} onClick={onClick} className={cls}>{children}</Link> : <button onClick={onClick} disabled={disabled} className={`${cls} disabled:cursor-not-allowed disabled:opacity-60`}>{children}</button>;
}

export function Header() {
  const router=useRouter();
  const navigation=useNavigationCatalog();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const searchPanel = useRef<HTMLDivElement>(null);
  useFocusTrap(searchPanel, search, () => setSearch(false));
  const [searchQuery,setSearchQuery]=useState("");
  const [searchData,setSearchData]=useState<{items:{id:number;slug:string;name:string;brand:string;category:string;price_cents:number;image_url?:string}[];recent:{query:string;results_count:number}[];popular:{query:string}[]}>({items:[],recent:[],popular:[]});
  const [searchLoading,setSearchLoading]=useState(false);
  const [cart, setCart] = useState(false);
  const {sessionId,cart:cartData,removeCartItem,settings}=useShop();
  useEffect(()=>{if(!search||!sessionId)return;const controller=new AbortController();const timer=setTimeout(async()=>{setSearchLoading(true);try{const response=await fetch(`/api/search?session_id=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(searchQuery)}`,{signal:controller.signal});const payload=await response.json();if(response.ok&&!controller.signal.aborted)setSearchData(payload.data);}catch(error){if((error as Error).name!=="AbortError")console.error(error);}finally{if(!controller.signal.aborted)setSearchLoading(false);}},searchQuery?220:0);return()=>{clearTimeout(timer);controller.abort();};},[search,searchQuery,sessionId]);
  const saveSearch=(query:string)=>fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,query})});
  const runSearch=async(query:string)=>{const value=query.trim();if(value.length<2)return;await saveSearch(value);setSearch(false);setSearchQuery("");router.push(`/busca?q=${encodeURIComponent(value)}`);};
  const openProduct=async(item:{slug:string;name:string})=>{await saveSearch(searchQuery.trim()||item.name);setSearch(false);setSearchQuery("");router.push(`/produto/${item.slug}`);};
  const clearRecent=async()=>{await fetch(`/api/search?session_id=${encodeURIComponent(sessionId)}`,{method:"DELETE"});setSearchData(current=>({...current,recent:[]}));};
  const menuLink="flex items-center justify-between border-b border-line py-3.5 text-[15px] font-semibold hover:text-accent";
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="hidden h-8 border-b border-line bg-canvas md:block">
          <div className="container-page flex h-full items-center gap-6 text-xs text-muted">
            <span>{settings.topbar_message}</span>
          </div>
        </div>
        <div className="container-page flex h-16 items-center gap-3 md:h-[72px] md:gap-6">
          <button aria-label="Abrir menu" className="focus-ring rounded-lg p-2 md:hidden" onClick={() => setMenu(true)}><Menu size={22}/></button>
          <Link href="/" className="mr-auto text-xl font-extrabold text-accent md:mr-0 md:w-[150px] md:text-2xl">RIDEKIT</Link>
          <button onClick={() => setSearch(true)} className="focus-ring hidden h-11 flex-1 items-center gap-3 rounded-lg border border-line bg-white px-4 text-left text-sm text-muted transition-colors hover:border-[#bdbdbd] md:flex">
            <span className="flex-1">Buscar capacetes, marcas ou acessórios</span><Search size={18} className="text-accent"/>
          </button>
          <nav aria-label="Navegação principal" className="hidden items-center gap-5 text-sm font-semibold md:flex">
            <Link className="hover:text-accent" href="/categorias">Categorias</Link><Link className="hover:text-accent" href="/conta/favoritos">Favoritos</Link><Link className="hover:text-accent" href="/conta">Minha conta</Link>
          </nav>
          <button aria-label="Buscar" onClick={() => setSearch(true)} className="focus-ring rounded-lg p-2 md:hidden"><Search size={21}/></button>
          <button aria-label={`Carrinho com ${cartData.summary.items} itens`} onClick={() => setCart(true)} className="focus-ring relative rounded-lg p-2 hover:text-accent"><ShoppingBag size={21}/>{cartData.summary.items>0&&<span className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{cartData.summary.items}</span>}</button>
        </div>
      </header>

      <Overlay open={menu} onClose={() => setMenu(false)} side="left">
        <div className="flex items-center justify-between"><b className="text-xl font-extrabold text-accent">RIDEKIT</b><Close onClick={() => setMenu(false)}/></div>
        <p className="mb-1 mt-6 text-xs font-bold text-muted">Comprar</p>
        <div className="grid">{navigation.categories.slice(0,5).map(item=><Link onClick={()=>setMenu(false)} className={menuLink} href={`/capacetes?category=${encodeURIComponent(item.slug)}`} key={item.slug}>{item.name}<ChevronRight size={16} className="text-muted"/></Link>)}{navigation.categories.length>5&&<Link onClick={()=>setMenu(false)} className="py-3 text-sm font-semibold text-brand" href="/categorias">Ver todas as categorias</Link>}{navigation.hasOffers&&<Link onClick={()=>setMenu(false)} className={menuLink} href="/ofertas">Ofertas<ChevronRight size={16} className="text-muted"/></Link>}{navigation.hasLaunches&&<Link onClick={()=>setMenu(false)} className={menuLink} href="/lancamentos">Lançamentos<ChevronRight size={16} className="text-muted"/></Link>}<Link onClick={()=>setMenu(false)} className={menuLink} href="/marcas">Marcas<ChevronRight size={16} className="text-muted"/></Link></div>
        <p className="mb-1 mt-6 text-xs font-bold text-muted">Sua conta</p>
        <div className="grid"><Link onClick={()=>setMenu(false)} className={menuLink} href="/conta/favoritos">Favoritos<ChevronRight size={16} className="text-muted"/></Link><Link onClick={()=>setMenu(false)} className={menuLink} href="/conta">Minha conta<ChevronRight size={16} className="text-muted"/></Link><Link onClick={()=>setMenu(false)} className={menuLink} href="/conta/pedidos">Meus pedidos<ChevronRight size={16} className="text-muted"/></Link></div>
        <div className="mt-8 rounded-lg border border-line p-4"><p className="font-bold">Precisa de ajuda?</p><p className="mt-1 text-sm text-muted">Atendimento por WhatsApp e e-mail em horário comercial.</p><Button href="/contato" variant="outline" className="mt-4 w-full" onClick={()=>setMenu(false)}>Fale conosco</Button></div>
      </Overlay>

      {search && <div className="fixed inset-0 z-50 bg-black/50 p-4" onMouseDown={()=>setSearch(false)}>
        <div ref={searchPanel} role="dialog" aria-modal="true" aria-label="Buscar produtos" className="mx-auto mt-6 max-w-3xl rounded-lg bg-white p-4 shadow-lg" onMouseDown={e=>e.stopPropagation()}>
          <form className="flex gap-2" onSubmit={event=>{event.preventDefault();runSearch(searchQuery);}}><div className="flex flex-1 items-center gap-3 rounded-lg border border-line px-3 focus-within:border-ink"><Search size={18} className="text-muted"/><input value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} autoFocus className="h-11 min-w-0 flex-1 outline-none" placeholder="O que você procura?"/>{searchLoading&&<span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent"/>}</div><Close onClick={()=>setSearch(false)}/></form>
          {searchQuery.trim().length>=2?<div className="mt-4"><p className="text-xs font-bold text-muted">Produtos</p>{searchData.items.length?<div className="mt-2 grid max-h-[55vh] gap-1 overflow-y-auto">{searchData.items.map(item=><button type="button" onClick={()=>openProduct(item)} className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-canvas" key={item.id}>{item.image_url?<img src={item.image_url} alt="" className="size-14 rounded-md object-cover"/>:<div className="size-14 rounded-md bg-canvas"/>}<span className="min-w-0 flex-1"><span className="block truncate text-sm">{item.name}</span><span className="block text-xs text-muted">{item.brand} · {item.category}</span><b className="mt-0.5 block text-sm">{formatMoney(item.price_cents)}</b></span><ChevronRight size={16} className="text-muted"/></button>)}</div>:!searchLoading&&<div className="mt-2 rounded-lg bg-canvas p-6 text-center text-sm text-muted">Nenhum resultado para “{searchQuery}”. Tente outra palavra ou uma marca.</div>}</div>:<div className="mt-5 grid gap-5">{searchData.recent.length>0&&<div><div className="flex items-center justify-between"><p className="text-xs font-bold text-muted">Buscas recentes</p><button onClick={clearRecent} className="text-xs font-semibold text-brand hover:underline">Limpar</button></div><div className="mt-2 flex flex-wrap gap-2">{searchData.recent.map(item=><button type="button" onClick={()=>runSearch(item.query)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-canvas" key={item.query}>{item.query} <span className="text-muted">({item.results_count})</span></button>)}</div></div>}<div><p className="text-xs font-bold text-muted">Buscas populares</p><div className="mt-2 flex flex-wrap gap-2">{searchData.popular.map(item=><button type="button" onClick={()=>runSearch(item.query)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-canvas" key={item.query}>{item.query}</button>)}</div></div></div>}
        </div>
      </div>}

      <Overlay open={cart} onClose={()=>setCart(false)} side="right">
        <div className="flex items-center justify-between"><b className="text-lg font-bold">Carrinho</b><Close onClick={()=>setCart(false)}/></div>
        {cartData.items.length?<><div className="mt-4 divide-y divide-line">{cartData.items.map(item=><MiniCartItem item={item} onRemove={()=>removeCartItem(item.id)} key={item.id}/>)}</div><div className="mt-4 border-t border-line pt-4"><div className="flex items-center justify-between text-sm"><span className="text-muted">Subtotal</span><b className="text-lg">{formatMoney(cartData.summary.subtotal_cents)}</b></div><Button href="/carrinho" className="mt-4 w-full" onClick={()=>setCart(false)}>Ver carrinho <ArrowRight size={17}/></Button></div></>:<div className="mt-8 rounded-lg bg-canvas p-6 text-center"><ShoppingBag className="mx-auto text-muted"/><b className="mt-3 block">Seu carrinho está vazio</b><p className="mt-1 text-sm text-muted">Veja os produtos e adicione o que quiser.</p><Button href="/capacetes" className="mt-4" onClick={()=>setCart(false)}>Ver produtos</Button></div>}
      </Overlay>
    </>
  );
}

function Close({onClick}:{onClick:()=>void}) { return <button type="button" aria-label="Fechar" onClick={onClick} className="focus-ring grid size-10 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"><X size={20}/></button>; }
function Overlay({children,onClose,side,open}:{children:React.ReactNode;onClose:()=>void;side:"left"|"right";open:boolean}) {
  const [rendered,setRendered]=useState(open),[active,setActive]=useState(false);
  useEffect(()=>{let firstFrame=0,secondFrame=0,timer:ReturnType<typeof setTimeout>|undefined;if(open){setRendered(true);setActive(false);firstFrame=requestAnimationFrame(()=>{secondFrame=requestAnimationFrame(()=>setActive(true));});}else{setActive(false);timer=setTimeout(()=>setRendered(false),260);}return()=>{cancelAnimationFrame(firstFrame);cancelAnimationFrame(secondFrame);if(timer)clearTimeout(timer);};},[open]);
  const panel=useRef<HTMLElement>(null);useFocusTrap(panel,open,onClose);
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous;};},[open]);
  if(!rendered)return null;
  return <div role="presentation" aria-hidden={!active} className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 ease-out motion-reduce:transition-none ${active?"opacity-100":"pointer-events-none opacity-0"}`} onMouseDown={onClose}><aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={side==="left"?"Menu de navegação":"Carrinho"} onMouseDown={e=>e.stopPropagation()} className={`absolute inset-y-0 ${side === "left" ? "left-0 w-full md:w-[360px]" : "right-0 w-[min(380px,92vw)]"} max-w-full overflow-y-auto bg-white p-5 shadow-lg will-change-transform transition-transform duration-250 ease-out motion-reduce:transform-none motion-reduce:transition-none ${active?"translate-x-0":side==="left"?"-translate-x-full":"translate-x-full"}`}>{children}</aside></div>;
}

function MiniCartItem({item,onRemove}:{item:CartItem;onRemove:()=>void}) { return <div className="flex gap-3 py-3"><ProductVisual image={item.image_url} className="size-16 shrink-0"/><div className="min-w-0 flex-1"><div className="flex gap-2"><span className="min-w-0 flex-1 truncate text-sm">{item.name}</span><button onClick={onRemove} aria-label={`Remover ${item.name}`} className="text-muted hover:text-danger"><X size={15}/></button></div><p className="mt-0.5 text-xs text-muted">{item.color} · {item.size} · {item.quantity} un.</p><b className="mt-1 block text-sm">{formatMoney(item.total_cents)}</b></div></div>; }

export // alt="" marks decorative copies (thumbnails next to a visible name); pass the stored alt for the main image.
function ProductVisual({tone="from-zinc-950 to-zinc-700", className="", image, rounded=true, alt=""}:{tone?:string;className?:string;image?:string;rounded?:boolean;alt?:string}) {
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[image]);
  return <div className={`relative grid min-h-24 place-items-center overflow-hidden bg-[#f0f0f0] ${rounded?"rounded-lg":""} ${className}`}>
    {image&&!failed ? <img src={image} onError={()=>setFailed(true)} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover"/> : <div role="img" aria-label="Imagem indisponível" className={`relative h-[55%] w-[58%] rounded-[48%_48%_38%_38%] bg-gradient-to-br ${tone} after:absolute after:right-[8%] after:top-[28%] after:h-[23%] after:w-[58%] after:rounded-full after:bg-slate-300/80 after:content-['']`} />}
  </div>;
}

export function ProductCard({product, compact=false}:{product:Product;compact?:boolean}) {
  const {toggleFavorite,isFavorite,busy,settings}=useShop(); const favorite=isFavorite(product.id);
  const [storeOrigin,setStoreOrigin]=useState("");
  useEffect(()=>setStoreOrigin(window.location.origin),[]);
  const outOfStock=product.availableStock===0;
  const whatsappEnabled=settings.purchase_mode==="whatsapp";
  const productUrl=`${storeOrigin}/produto/${product.slug}`;
  const whatsappMessage=[
    settings.whatsapp_message_intro,
    "",
    `*Produto: ${product.brand} ${product.name}*`,
    `Marca: ${product.brand}`,
    product.category?`Categoria: ${product.category}`:"",
    `Valor: ${product.price}`,
    product.oldPrice?`Valor anterior: ${product.oldPrice}`:"",
    product.sizes?.length?`Tamanhos disponíveis: ${product.sizes.map(size=>size.replace(" / ","/")).join(", ")}`:"Tamanho: confirmar disponibilidade",
    `Condições: até ${settings.max_installments}x sem juros · ${settings.pix_discount_percent}% de desconto no Pix`,
    "Disponibilidade: em estoque",
    storeOrigin?`Link do produto: ${productUrl}`:"",
    "",
    "Gostaria de confirmar o tamanho e a disponibilidade para compra.",
  ].filter(Boolean).join("\n");
  const whatsappHref=`https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(whatsappMessage)}`;
  return <article className="card card-hover group flex flex-col overflow-hidden">
      <div className="relative"><Link href={`/produto/${product.slug}`} className="block"><ProductVisual rounded={false} tone={product.tone} image={product.image} alt={`${product.brand} ${product.name}`} className={`${compact?"aspect-square":"aspect-[1.1]"} ${outOfStock?"opacity-60 grayscale":""}`}/></Link>{outOfStock?<span className="absolute left-2 top-2 rounded bg-ink px-2 py-0.5 text-[11px] font-bold text-white">Sem estoque</span>:product.tag&&<span className="absolute left-2 top-2 rounded bg-white px-2 py-0.5 text-[11px] font-bold text-ink shadow-sm">{product.tag}</span>}<button disabled={!product.id||busy} onClick={()=>product.id&&toggleFavorite(product.id)} aria-label={favorite?`Remover ${product.name} dos favoritos`:`Adicionar ${product.name} aos favoritos`} aria-pressed={favorite} className={`focus-ring absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white shadow-sm transition-colors ${favorite?"text-accent":"text-muted hover:text-accent"}`}><Heart size={17} className={favorite?"fill-current":""}/></button></div>
    <div className="flex flex-1 flex-col p-3">
    <Link href={`/produto/${product.slug}`} className="block">
      <p className="text-xs text-muted">{product.brand}</p>
      <h3 className="line-clamp-2 mt-0.5 min-h-[2.6em] text-sm leading-snug text-ink">{product.name}</h3>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">{product.oldPrice&&<s className="text-xs text-muted">{product.oldPrice}</s>}<b className="text-lg font-extrabold">{product.price}</b></div>
      <p className="text-xs text-muted">{settings.max_installments}x sem juros · {settings.pix_discount_percent}% no Pix</p>
      {product.sizes&&product.sizes.length>0&&<div className="mt-2 flex flex-wrap gap-1" aria-label="Tamanhos disponíveis">{product.sizes.map(size=><span key={size} className="rounded border border-line px-1.5 text-[11px] leading-5 text-muted">{size.replace(" / ","/")}</span>)}</div>}
    </Link>
    {outOfStock?<div className="mt-auto pt-3"><div aria-disabled="true" className="flex min-h-10 w-full items-center justify-center rounded-lg bg-canvas px-3 text-sm font-semibold text-muted">Indisponível</div></div>:<div className="mt-auto grid gap-2 pt-3"><Link href={`/produto/${product.slug}`} aria-label={`Adicionar ${product.name} ao carrinho`} className="focus-ring flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-bold text-white transition-colors hover:bg-accent-strong"><ShoppingBag size={17}/>Adicionar ao carrinho</Link>{whatsappEnabled&&<a href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label={`Comprar ${product.name} pelo WhatsApp`} className="focus-ring flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f7a35] px-3 text-sm font-bold text-white transition-colors hover:bg-[#1fb958]"><WhatsAppIcon className="size-[18px] shrink-0"/>Comprar pelo WhatsApp</a>}</div>}
    </div>
  </article>;
}

export function ProductGrid({products, compact=false}:{products:Product[];compact?:boolean}) { return <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">{products.map(p=><ProductCard product={p} compact={compact} key={p.id??p.slug}/>)}</div>; }

export function Footer() {
  const navigation=useNavigationCatalog();
  const categoryLinks:[string,string][]=navigation.categories.slice(0,5).map(item=>[item.name,`/capacetes?category=${encodeURIComponent(item.slug)}`]);
  if(navigation.categories.length>5)categoryLinks.push(["Todas as categorias","/categorias"]);
  return <footer className="mt-12 border-t border-line bg-white md:mt-16">
    <div className="container-page py-10">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-[1fr_1fr_1fr_1.6fr] md:gap-10">
        <div><FooterColumn title="Comprar" links={categoryLinks}/><div className="mt-3 grid gap-2 text-sm text-muted">{navigation.hasOffers&&<Link className="hover:text-accent hover:underline" href="/ofertas">Ofertas</Link>}{navigation.hasLaunches&&<Link className="hover:text-accent hover:underline" href="/lancamentos">Lançamentos</Link>}<Link className="hover:text-accent hover:underline" href="/marcas">Marcas</Link></div></div>
        <FooterColumn title="Ajuda" links={[["Central de ajuda","/ajuda"],["Trocas e devoluções","/ajuda/devolucoes"],["Guia de tamanho","/guia-de-tamanho"],["Rastrear pedido","/conta/pedidos"],["Fale conosco","/contato"]]}/>
        <FooterColumn title="Ridekit" links={[["Sobre a loja","/sobre"],["Frete e entrega","/entrega"],["Garantia","/garantia"],["Política de privacidade","/privacidade"],["Termos de uso","/termos"]]}/>
        <NewsletterSignup/>
      </div>
      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><ShieldCheck size={14}/> Compra segura</span><span>Nota fiscal</span><span>Troca em até 7 dias</span><span>Pix e cartão</span><span>Entrega para todo o Brasil</span></div>
      <p className="mt-6 text-xs text-muted">© {new Date().getFullYear()} Ridekit. Todos os direitos reservados.</p>
    </div>
  </footer>;
}
function NewsletterSignup(){const [status,setStatus]=useState(""),[busy,setBusy]=useState(false);const submit=async(event:React.FormEvent<HTMLFormElement>)=>{try{event.preventDefault();setBusy(true);const form=event.currentTarget,email=String(new FormData(form).get("email")||""),response=await fetch("/api/newsletter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})}),payload=await response.json();setStatus(response.ok?"Pronto! Você vai receber nossas ofertas.":payload.error||"Não foi possível cadastrar.");if(response.ok)form.reset();setBusy(false);}catch{setStatus("Falha de conexão. Verifique a internet e tente novamente.");}finally{setBusy(false);}};return <div className="col-span-2 md:col-span-1"><b className="text-sm">Receba ofertas por e-mail</b><p className="mt-2 text-sm text-muted">Enviamos promoções e novidades. Você pode cancelar quando quiser.</p><form onSubmit={submit} className="mt-3 flex gap-2"><input required type="email" name="email" aria-label="Seu e-mail" className="h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-ink" placeholder="Seu e-mail"/><button disabled={busy} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-bold text-white hover:bg-accent-strong disabled:opacity-60">{busy?"Enviando…":"Cadastrar"}</button></form>{status&&<p role="status" className="mt-2 text-xs text-muted">{status}</p>}</div>;}
function FooterColumn({title,links}:{title:string;links:[string,string][]}) { return <div><b className="text-sm">{title}</b><div className="mt-3 grid gap-2 text-sm text-muted">{links.map(([n,h])=><Link className="hover:text-accent hover:underline" href={h} key={`${n}-${h}`}>{n}</Link>)}</div></div>; }

type NavigationCategory={name:string;slug:string;product_count:number};
function useNavigationCatalog(){const [data,setData]=useState<{categories:NavigationCategory[];hasOffers:boolean;hasLaunches:boolean}>({categories:[],hasOffers:false,hasLaunches:false});useEffect(()=>{const controller=new AbortController();fetch("/api/catalog",{signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(body=>{const products=body.data.filter_products as {on_sale:number;is_new:number}[];setData({categories:(body.data.categories as NavigationCategory[]).filter(item=>item.product_count>0),hasOffers:products.some(item=>item.on_sale),hasLaunches:products.some(item=>item.is_new)});}).catch(()=>{});return()=>controller.abort();},[]);return data;}

export function TrustStrip() { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[ShieldCheck,"Produto original","Nota fiscal e garantia do fabricante."],[Package,"Troca em até 7 dias","Errou o tamanho ou mudou de ideia? A gente resolve."],[Truck,"Entrega rastreada","Código de rastreio enviado por e-mail."],[Headset,"Atendimento","Suporte por WhatsApp e e-mail em horário comercial."]].map(([Icon,t,d])=><div className="card flex items-start gap-3 p-4" key={String(t)}><span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Icon size={20}/></span><div><b className="block text-sm">{String(t)}</b><p className="mt-0.5 text-xs text-muted">{String(d)}</p></div></div>)}</div>; }

export function SectionTitle({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}) { return <div className="mb-4 flex items-end justify-between gap-4"><div>{eyebrow&&<p className="mb-1 text-xs font-semibold text-muted">{eyebrow}</p>}<h2 className="text-xl font-bold md:text-2xl">{title}</h2>{description&&<p className="mt-1 text-sm text-muted">{description}</p>}</div>{action}</div>; }

export function Rating({ rating, count }: { rating?: number | null; count?: number | null }) { if (!count) return <span className="text-xs text-muted">Sem avaliações ainda</span>; return <span className="inline-flex items-center gap-1 text-xs text-muted"><Star size={14} aria-hidden="true" className="fill-accent text-accent"/> {Number(rating || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ({count} {count === 1 ? "avaliação" : "avaliações"})</span>; }

export function Quantity({value,onChange,max=10}:{value?:number;onChange?:(value:number)=>void;max?:number}) { const [internal,setInternal]=useState(1);const current=value??internal;const update=(next:number)=>{const resolved=Math.max(1,Math.min(max,next));if(onChange)onChange(resolved);else setInternal(resolved);};return <div className="inline-flex h-11 items-center rounded-lg border border-line bg-white"><button aria-label="Diminuir quantidade" className="grid size-10 place-items-center disabled:opacity-35" disabled={current<=1} onClick={()=>update(current-1)}><Minus size={16}/></button><b className="w-8 text-center text-sm">{current}</b><button aria-label="Aumentar quantidade" className="grid size-10 place-items-center disabled:opacity-35" disabled={current>=max} onClick={()=>update(current+1)}><Plus size={16}/></button></div>; }

export function CheckLine({children}:{children:React.ReactNode}) { return <div className="flex gap-3 text-sm text-muted"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-green-50 text-success"><Check size={13}/></span>{children}</div>; }

export { ChevronDown };
