"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Check, ChevronDown, Heart, Menu, Minus, Package, Search,
  ShieldCheck, ShoppingBag, SlidersHorizontal, Star, Truck, User, X, Plus, Scale,
} from "lucide-react";
import type { Product } from "@/lib/catalog";
import { useShop, type CartItem } from "@/components/shop-state";

const formatMoney=(cents:number)=>(cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function Button({ children, href, variant = "primary", className = "", onClick }: {
  children: React.ReactNode; href?: string; variant?: "primary" | "dark" | "outline" | "ghost";
  className?: string; onClick?: () => void;
}) {
  const styles = {
    primary: "bg-accent text-white hover:bg-[#e94600]",
    dark: "bg-dark text-white hover:bg-[#20242a]",
    outline: "border border-line bg-white text-ink hover:border-ink",
    ghost: "bg-transparent text-ink hover:bg-[#f1f3f5]",
  }[variant];
  const cls = `focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition ${styles} ${className}`;
  return href ? <Link href={href} onClick={onClick} className={cls}>{children}</Link> : <button onClick={onClick} className={cls}>{children}</button>;
}

export function Header() {
  const router=useRouter();
  const navigation=useNavigationCatalog();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [searchQuery,setSearchQuery]=useState("");
  const [searchData,setSearchData]=useState<{items:{id:number;slug:string;name:string;brand:string;category:string;price_cents:number;image_url?:string}[];recent:{query:string;results_count:number}[];popular:{query:string}[]}>({items:[],recent:[],popular:[]});
  const [searchLoading,setSearchLoading]=useState(false);
  const [cart, setCart] = useState(false);
  const {sessionId,cart:cartData,removeCartItem,settings}=useShop();
  useEffect(()=>{if(!search||!sessionId)return;const controller=new AbortController();const timer=setTimeout(async()=>{setSearchLoading(true);try{const response=await fetch(`/api/search?session_id=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(searchQuery)}`,{signal:controller.signal});const payload=await response.json();if(response.ok)setSearchData(payload.data);}catch(error){if((error as Error).name!=="AbortError")console.error(error);}finally{setSearchLoading(false);}},searchQuery?220:0);return()=>{clearTimeout(timer);controller.abort();};},[search,searchQuery,sessionId]);
  const saveSearch=(query:string)=>fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId,query})});
  const runSearch=async(query:string)=>{const value=query.trim();if(value.length<2)return;await saveSearch(value);setSearch(false);setSearchQuery("");router.push(`/busca?q=${encodeURIComponent(value)}`);};
  const openProduct=async(item:{slug:string;name:string})=>{await saveSearch(searchQuery.trim()||item.name);setSearch(false);setSearchQuery("");router.push(`/produto/${item.slug}`);};
  const clearRecent=async()=>{await fetch(`/api/search?session_id=${encodeURIComponent(sessionId)}`,{method:"DELETE"});setSearchData(current=>({...current,recent:[]}));};
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="hidden h-8 bg-dark text-white md:block">
          <div className="container-page flex h-full items-center gap-6 text-[11px] font-medium">
            <span>{settings.topbar_message}</span>
          </div>
        </div>
        <div className="container-page flex h-16 items-center gap-3 md:h-20 md:gap-6">
          <button aria-label="Abrir menu" className="focus-ring rounded-lg p-2 md:hidden" onClick={() => setMenu(true)}><Menu size={22}/></button>
          <Link href="/" className="mr-auto text-xl font-bold tracking-[-.04em] md:mr-0 md:w-[150px] md:text-2xl">RIDEKIT</Link>
          <button onClick={() => setSearch(true)} className="hidden h-12 flex-1 items-center gap-3 rounded-xl bg-canvas px-4 text-left text-sm text-muted md:flex">
            <Search size={18}/> Buscar capacetes, marcas ou acessórios…
          </button>
          <nav aria-label="Navegação principal" className="hidden items-center gap-5 text-[13px] font-medium md:flex">
            <Link href="/categorias">Categorias</Link><Link href="/comparar">Comparar</Link><Link href="/conta/favoritos">Favoritos</Link><Link href="/conta">Conta</Link>
          </nav>
          <button aria-label="Buscar" onClick={() => setSearch(true)} className="focus-ring rounded-lg p-2 md:hidden"><Search size={21}/></button>
          <button aria-label={`Carrinho com ${cartData.summary.items} itens`} onClick={() => setCart(true)} className="focus-ring relative rounded-lg p-2"><ShoppingBag size={21}/>{cartData.summary.items>0&&<span className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">{cartData.summary.items}</span>}</button>
        </div>
      </header>

      {menu && <Overlay onClose={() => setMenu(false)} side="left">
        <div className="flex items-center justify-between"><b className="text-xl">RIDEKIT</b><Close onClick={() => setMenu(false)}/></div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-muted">Comprar</p>
        <div className="mt-3 grid gap-1">{navigation.categories.slice(0,5).map(item=><Link onClick={()=>setMenu(false)} className="rounded-xl px-3 py-3 text-lg font-semibold hover:bg-canvas" href={`/capacetes?category=${encodeURIComponent(item.slug)}`} key={item.slug}>{item.name}</Link>)}{navigation.categories.length>5&&<Link onClick={()=>setMenu(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-accent hover:bg-canvas" href="/categorias">Ver mais categorias →</Link>}<div className="my-2 border-t border-line"/>{navigation.hasOffers&&<Link onClick={()=>setMenu(false)} className="rounded-xl px-3 py-3 text-lg font-semibold hover:bg-canvas" href="/ofertas">Ofertas</Link>}{navigation.hasLaunches&&<Link onClick={()=>setMenu(false)} className="rounded-xl px-3 py-3 text-lg font-semibold hover:bg-canvas" href="/lancamentos">Lançamentos</Link>}<Link onClick={()=>setMenu(false)} className="rounded-xl px-3 py-3 text-lg font-semibold hover:bg-canvas" href="/marcas">Marcas</Link><Link onClick={()=>setMenu(false)} className="rounded-xl px-3 py-3 text-lg font-semibold hover:bg-canvas" href="/conta/favoritos">Favoritos</Link><Link onClick={()=>setMenu(false)} className="rounded-xl px-3 py-3 text-lg font-semibold hover:bg-canvas" href="/conta">Minha conta</Link></div>
        <div className="mt-8 rounded-2xl bg-dark p-5 text-white"><p className="text-lg font-semibold">Precisa de ajuda?</p><p className="mt-2 text-sm text-[#aeb4bd]">Fale com quem entende de equipamento.</p><Button href="/contato" className="mt-4 w-full">Falar com a Ridekit</Button></div>
      </Overlay>}

      {search && <div className="fixed inset-0 z-50 bg-dark/70 p-4 backdrop-blur-sm" onMouseDown={()=>setSearch(false)}>
        <div className="mx-auto mt-10 max-w-3xl rounded-3xl bg-white p-5 shadow-2xl" onMouseDown={e=>e.stopPropagation()}>
          <form className="flex gap-3" onSubmit={event=>{event.preventDefault();runSearch(searchQuery);}}><div className="flex flex-1 items-center gap-3 rounded-xl border border-line px-4"><Search size={19}/><input value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} autoFocus className="h-12 min-w-0 flex-1 outline-none" placeholder="O que você procura?"/>{searchLoading&&<span className="size-4 animate-spin rounded-full border-2 border-line border-t-accent"/>}</div><Close onClick={()=>setSearch(false)}/></form>
          {searchQuery.trim().length>=2?<div className="mt-5"><p className="text-xs font-semibold uppercase tracking-widest text-muted">Produtos encontrados</p>{searchData.items.length?<div className="mt-3 grid max-h-[55vh] gap-2 overflow-y-auto">{searchData.items.map(item=><button type="button" onClick={()=>openProduct(item)} className="flex items-center gap-4 rounded-2xl border border-line p-3 text-left transition hover:border-ink hover:bg-canvas" key={item.id}>{item.image_url?<img src={item.image_url} alt="" className="size-16 rounded-xl object-cover"/>:<div className="size-16 rounded-xl bg-canvas"/>}<span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted">{item.brand} · {item.category}</span><b className="mt-1 block truncate text-sm">{item.name}</b><span className="mt-1 block text-sm">{formatMoney(item.price_cents)}</span></span><ArrowRight size={17}/></button>)}</div>:!searchLoading&&<div className="mt-3 rounded-2xl bg-canvas p-6 text-center text-sm text-muted">Nenhum produto corresponde a “{searchQuery}”. Tente uma marca, categoria ou modelo.</div>}</div>:<div className="mt-6 grid gap-6">{searchData.recent.length>0&&<div><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-widest text-muted">Buscas recentes</p><button onClick={clearRecent} className="text-xs font-semibold text-muted hover:text-ink">Limpar</button></div><div className="mt-3 flex flex-wrap gap-2">{searchData.recent.map(item=><button type="button" onClick={()=>runSearch(item.query)} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink" key={item.query}>{item.query} <span className="text-muted">({item.results_count})</span></button>)}</div></div>}<div><p className="text-xs font-semibold uppercase tracking-widest text-muted">Buscas populares</p><div className="mt-3 flex flex-wrap gap-2">{searchData.popular.map(item=><button type="button" onClick={()=>runSearch(item.query)} className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink" key={item.query}>{item.query}</button>)}</div></div></div>}
        </div>
      </div>}

      {cart && <Overlay onClose={()=>setCart(false)} side="right">
        <div className="flex items-center justify-between"><b className="text-xl">Seu carrinho</b><Close onClick={()=>setCart(false)}/></div>
        {cartData.items.length?<><div className="mt-8 grid gap-4">{cartData.items.map(item=><MiniCartItem item={item} onRemove={()=>removeCartItem(item.id)} key={item.id}/>)}</div><div className="mt-8 border-t border-line pt-5"><div className="flex justify-between text-sm text-muted"><span>Subtotal</span><b className="text-lg text-ink">{formatMoney(cartData.summary.subtotal_cents)}</b></div><Button href="/carrinho" className="mt-5 w-full" onClick={()=>setCart(false)}>Revisar carrinho <ArrowRight size={17}/></Button></div></>:<div className="mt-10 rounded-2xl bg-canvas p-7 text-center"><ShoppingBag className="mx-auto text-muted"/><b className="mt-4 block">Seu carrinho está vazio</b><p className="mt-2 text-xs text-muted">Adicione um produto para começar.</p><Button href="/capacetes" className="mt-5" onClick={()=>setCart(false)}>Ver produtos</Button></div>}
      </Overlay>}
    </>
  );
}

function Close({onClick}:{onClick:()=>void}) { return <button type="button" aria-label="Fechar" onClick={onClick} className="focus-ring rounded-xl border border-line p-2"><X size={20}/></button>; }
function Overlay({children,onClose,side}:{children:React.ReactNode;onClose:()=>void;side:"left"|"right"}) { useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close);},[onClose]);return <div role="presentation" className="fixed inset-0 z-50 bg-dark/60 backdrop-blur-sm" onMouseDown={onClose}><aside role="dialog" aria-modal="true" aria-label={side==="left"?"Menu de navegação":"Carrinho"} onMouseDown={e=>e.stopPropagation()} className={`absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} w-[min(390px,92vw)] overflow-y-auto bg-white p-6 shadow-2xl`}>{children}</aside></div>; }

function MiniCartItem({item,onRemove}:{item:CartItem;onRemove:()=>void}) { return <div className="flex gap-4 rounded-2xl border border-line p-3"><ProductVisual image={item.image_url} className="size-20 shrink-0"/><div className="min-w-0 flex-1"><div className="flex gap-2"><b className="min-w-0 flex-1 truncate text-sm">{item.name}</b><button onClick={onRemove} aria-label={`Remover ${item.name}`} className="text-muted hover:text-danger"><X size={15}/></button></div><p className="mt-1 text-xs text-muted">{item.color} · {item.size}</p><div className="mt-3 flex items-center justify-between"><span className="text-xs">Qtd. {item.quantity}</span><b className="text-sm">{formatMoney(item.total_cents)}</b></div></div></div>; }

export function ProductVisual({tone="from-zinc-950 to-zinc-700", className="", image}:{tone?:string;className?:string;image?:string}) {
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[image]);
  return <div className={`relative grid min-h-24 place-items-center overflow-hidden rounded-[14px] bg-[#f1f3f5] ${className}`}>
    {image&&!failed ? <img src={image} onError={()=>setFailed(true)} alt="Equipamento para motociclista" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"/> : <div role="img" aria-label="Imagem indisponível" className={`relative h-[55%] w-[58%] rounded-[48%_48%_38%_38%] bg-gradient-to-br ${tone} shadow-lg after:absolute after:right-[8%] after:top-[28%] after:h-[23%] after:w-[58%] after:rounded-full after:bg-slate-300/80 after:content-['']`} />}
  </div>;
}

function useCompare(product:Product){const [selected,setSelected]=useState(false);useEffect(()=>{try{const items=JSON.parse(localStorage.getItem("ridekit-compare")||"[]") as Product[];setSelected(items.some(item=>item.slug===product.slug));}catch{setSelected(false);}},[product.slug]);const toggle=()=>{let items:Product[]=[];try{items=JSON.parse(localStorage.getItem("ridekit-compare")||"[]");}catch{}if(items.some(item=>item.slug===product.slug))items=items.filter(item=>item.slug!==product.slug);else items=[...items.slice(-2),product];localStorage.setItem("ridekit-compare",JSON.stringify(items));setSelected(items.some(item=>item.slug===product.slug));window.dispatchEvent(new Event("ridekit-compare-change"));};return {selected,toggle};}

export function ProductCard({product, compact=false}:{product:Product;compact?:boolean}) {
  const {toggleFavorite,isFavorite,busy,settings}=useShop(); const favorite=isFavorite(product.id);const compare=useCompare(product);
  return <article className="group rounded-[18px] border border-line bg-white p-3 transition hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(11,13,16,.10)] md:p-4">
      <div className="relative"><Link href={`/produto/${product.slug}`} className="block"><ProductVisual tone={product.tone} image={product.image} className={compact?"aspect-square":"aspect-[1.15]"}/></Link>{product.tag&&<span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[9px] font-bold tracking-wide">{product.tag}</span>}<button disabled={!product.id||busy} onClick={()=>product.id&&toggleFavorite(product.id)} aria-label={favorite?`Remover ${product.name} dos favoritos`:`Adicionar ${product.name} aos favoritos`} aria-pressed={favorite} className={`focus-ring absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 transition ${favorite?"text-accent":"text-muted hover:text-accent"}`}><Heart size={17} className={favorite?"fill-current":""}/></button></div>
    <Link href={`/produto/${product.slug}`} className="block">
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">{product.brand}</p>
      <h3 className="mt-1 truncate text-sm font-semibold md:text-base">{product.name}</h3>
      <div className="mt-2 flex items-baseline gap-2">{product.oldPrice&&<s className="text-xs text-muted">{product.oldPrice}</s>}<b className="text-base md:text-lg">{product.price}</b></div>
      <p className="mt-1 text-[10px] text-muted md:text-xs">{settings.max_installments}x sem juros · {settings.pix_discount_percent}% no Pix</p>
      {product.sizes&&product.sizes.length>0&&<div className="mt-3 flex flex-wrap gap-1.5" aria-label="Tamanhos disponíveis">{product.sizes.map(size=><span key={size} className="grid h-8 min-w-8 place-items-center rounded-lg border border-line px-2 text-[11px]">{size.replace(" / ","/")}</span>)}</div>}
    </Link><button type="button" onClick={compare.toggle} aria-pressed={compare.selected} className={`focus-ring mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-semibold ${compare.selected?"border-accent bg-accent-soft text-accent":"border-line text-muted hover:border-ink hover:text-ink"}`}><Scale size={15}/>{compare.selected?"Adicionado ao comparador":"Comparar"}</button>
  </article>;
}

export function ProductGrid({products, compact=false}:{products:Product[];compact?:boolean}) { return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{products.map((p,i)=><ProductCard product={p} compact={compact} key={`${p.slug}-${i}`}/>)}</div>; }

export function Footer() {
  const navigation=useNavigationCatalog();
  const categoryLinks:[string,string][]=navigation.categories.slice(0,5).map(item=>[item.name,`/capacetes?category=${encodeURIComponent(item.slug)}`]);
  if(navigation.categories.length>5)categoryLinks.push(["Ver mais categorias →","/categorias"]);
  return <footer className="mt-16 bg-dark text-white md:mt-24">
    <div className="container-page py-10 md:py-14"><p className="text-2xl font-bold tracking-[-.04em]">RIDEKIT</p>
      <div className="mt-8 grid grid-cols-2 gap-8 text-sm md:grid-cols-[1fr_1fr_1fr_2fr] md:gap-12">
        <div><FooterColumn title="Comprar" links={categoryLinks}/><div className="mt-4 grid gap-2.5 border-t border-white/10 pt-4 text-xs text-[#aeb4bd]">{navigation.hasOffers&&<Link className="hover:text-white" href="/ofertas">Ofertas</Link>}{navigation.hasLaunches&&<Link className="hover:text-white" href="/lancamentos">Lançamentos</Link>}</div></div>
        <FooterColumn title="Ajuda" links={[["Central de ajuda","/ajuda"],["Trocas e devoluções","/ajuda/devolucoes"],["Guia de tamanho","/guia-de-tamanho"],["Rastrear pedido","/conta/pedidos"],["Fale conosco","/contato"]]}/>
        <FooterColumn title="Institucional" links={[["Sobre a Ridekit","/sobre"],["Política de privacidade","/privacidade"],["Termos de uso","/termos"],["Garantia","/garantia"],["Segurança","/garantia"]]}/>
        <NewsletterSignup/>
      </div>
      <div className="mt-10 flex flex-wrap gap-5 border-t border-white/15 pt-6 text-xs text-[#c8cdd4]"><span>Compra segura</span><span>Nota fiscal</span><span>Troca facilitada</span><span>Pix e cartão</span><span>Atendimento humano</span></div>
      <p className="mt-8 text-[11px] text-[#7f8791]">© 2026 Ridekit · Todos os direitos reservados · CNPJ 00.000.000/0001-00</p>
    </div>
  </footer>;
}
function NewsletterSignup(){const [status,setStatus]=useState(""),[busy,setBusy]=useState(false);const submit=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setBusy(true);const form=event.currentTarget,email=String(new FormData(form).get("email")||""),response=await fetch("/api/newsletter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})}),payload=await response.json();setStatus(response.ok?"Cadastro realizado.":payload.error||"Não foi possível cadastrar.");if(response.ok)form.reset();setBusy(false);};return <div className="col-span-2 md:col-span-1"><b>Receba ofertas e lançamentos</b><p className="mt-3 text-xs leading-5 text-[#aeb4bd]">Conteúdo útil, promoções e novidades. Sem avalanche de spam.</p><form onSubmit={submit} className="mt-4 flex gap-2"><input required type="email" name="email" aria-label="Seu e-mail" className="min-w-0 flex-1 rounded-xl bg-[#1a1d22] px-4 text-sm outline-none" placeholder="Seu e-mail"/><button disabled={busy} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-white">{busy?"Enviando…":"Cadastrar"}</button></form>{status&&<p role="status" className="mt-2 text-xs text-[#aeb4bd]">{status}</p>}</div>;}
function FooterColumn({title,links}:{title:string;links:[string,string][]}) { return <div><b>{title}</b><div className="mt-3 grid gap-2.5 text-xs text-[#aeb4bd]">{links.map(([n,h])=><Link className="hover:text-white" href={h} key={`${n}-${h}`}>{n}</Link>)}</div></div>; }

type NavigationCategory={name:string;slug:string;product_count:number};
function useNavigationCatalog(){const [data,setData]=useState<{categories:NavigationCategory[];hasOffers:boolean;hasLaunches:boolean}>({categories:[],hasOffers:false,hasLaunches:false});useEffect(()=>{const controller=new AbortController();fetch("/api/catalog",{signal:controller.signal}).then(response=>response.ok?response.json():Promise.reject()).then(body=>{const products=body.data.filter_products as {on_sale:number;is_new:number}[];setData({categories:(body.data.categories as NavigationCategory[]).filter(item=>item.product_count>0),hasOffers:products.some(item=>item.on_sale),hasLaunches:products.some(item=>item.is_new)});}).catch(()=>{});return()=>controller.abort();},[]);return data;}

export function TrustStrip() { return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[ShieldCheck,"Produto original","Procedência, nota fiscal e garantia."],[Package,"Troca facilitada","Processo simples para tamanho e devolução."],[Truck,"Entrega rastreável","Acompanhe cada etapa do pedido."],[User,"Atendimento humano","Ajuda por chat e WhatsApp."]].map(([Icon,t,d])=><div className="card p-5" key={String(t)}><Icon size={22} className="text-accent"/><b className="mt-4 block text-sm">{String(t)}</b><p className="mt-2 text-xs leading-5 text-muted">{String(d)}</p></div>)}</div>; }

export function SectionTitle({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}) { return <div className="mb-6 flex items-end justify-between gap-4"><div>{eyebrow&&<p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-accent">{eyebrow}</p>}<h2 className="text-2xl font-semibold tracking-[-.03em] md:text-[28px]">{title}</h2>{description&&<p className="mt-2 text-sm text-muted">{description}</p>}</div>{action}</div>; }

export function FilterBar() { const [filters,setFilters]=useState(false); return <><div className="mb-5 flex items-center justify-between gap-3"><Button variant="outline" onClick={()=>setFilters(!filters)}><SlidersHorizontal size={17}/> Filtros</Button><select className="h-11 rounded-xl border border-line bg-white px-4 text-sm"><option>Mais relevantes</option><option>Menor preço</option><option>Maior preço</option></select></div>{filters&&<div className="mb-6 grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-4">{["Marca","Tamanho","Preço","Acabamento"].map(n=><label className="text-xs font-semibold" key={n}>{n}<select className="mt-2 h-11 w-full rounded-xl border border-line px-3 font-normal text-muted"><option>Todos</option><option>Opção selecionada</option></select></label>)}</div>}</>; }

export function Rating() { return <span className="inline-flex items-center gap-1 text-xs text-muted"><Star size={14} className="fill-accent text-accent"/> 4,9 (124)</span>; }

export function Quantity({value,onChange,max=10}:{value?:number;onChange?:(value:number)=>void;max?:number}) { const [internal,setInternal]=useState(1);const current=value??internal;const update=(next:number)=>{const resolved=Math.max(1,Math.min(max,next));if(onChange)onChange(resolved);else setInternal(resolved);};return <div className="inline-flex h-11 items-center rounded-xl border border-line bg-white"><button aria-label="Diminuir quantidade" className="grid size-10 place-items-center disabled:opacity-35" disabled={current<=1} onClick={()=>update(current-1)}><Minus size={16}/></button><b className="w-8 text-center text-sm">{current}</b><button aria-label="Aumentar quantidade" className="grid size-10 place-items-center disabled:opacity-35" disabled={current>=max} onClick={()=>update(current+1)}><Plus size={16}/></button></div>; }

export function CheckLine({children}:{children:React.ReactNode}) { return <div className="flex gap-3 text-sm text-muted"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-green-50 text-success"><Check size={13}/></span>{children}</div>; }

export { ChevronDown };
