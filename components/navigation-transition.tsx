"use client";

import { usePathname,useSearchParams } from "next/navigation";
import { useEffect,useLayoutEffect,useRef,useState } from "react";

export function NavigationTransition(){
  const pathname=usePathname(),searchParams=useSearchParams(),routeKey=`${pathname}?${searchParams.toString()}`;
  const [visible,setVisible]=useState(false),pending=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),previousPathname=useRef(pathname);
  useLayoutEffect(()=>{
    const changed=previousPathname.current!==pathname;
    previousPathname.current=pathname;
    if(!changed||pathname.startsWith("/admin"))return;
    const root=document.documentElement,previous=root.style.scrollBehavior;
    root.style.scrollBehavior="auto";
    window.scrollTo({top:0,left:0,behavior:"auto"});
    root.style.scrollBehavior=previous;
  },[pathname]);
  useEffect(()=>{if(!pending.current)return;timer.current=setTimeout(()=>{setVisible(false);pending.current=false;},180);return()=>{if(timer.current)clearTimeout(timer.current);};},[routeKey]);
  useEffect(()=>{const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const target=event.target as Element|null,anchor=target?.closest("a[href]") as HTMLAnchorElement|null;if(!anchor||anchor.target==="_blank"||anchor.hasAttribute("download"))return;const next=new URL(anchor.href,window.location.href);if(next.origin!==window.location.origin||next.href===window.location.href||next.hash&&next.pathname===location.pathname&&next.search===location.search)return;pending.current=true;setVisible(true);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{setVisible(false);pending.current=false;},2200);};document.addEventListener("click",click,true);return()=>document.removeEventListener("click",click,true);},[]);
  if(!visible)return null;
  return <div role="status" aria-live="polite" aria-label="Carregando nova página" className="fixed inset-0 z-[100] overflow-hidden bg-canvas">
    {pathname.startsWith("/admin")?<AdminTransitionSkeleton/>:<StoreTransitionSkeleton/>}
    <span className="sr-only">Carregando conteúdo…</span>
  </div>;
}

function StoreTransitionSkeleton(){return <div className="min-h-screen"><div className="h-16 border-b border-line bg-white md:h-28"><div className="container-page flex h-full items-center gap-5"><Block className="h-7 w-28"/><Block className="hidden h-12 flex-1 md:block"/><Block className="size-10"/><Block className="size-10"/></div></div><main className="container-page py-7 md:py-10"><Block className="h-3 w-48"/><div className="mt-6 grid gap-8 lg:grid-cols-[1.08fr_.92fr]"><Block className="aspect-square w-full rounded-3xl"/><div className="space-y-5 lg:pt-5"><Block className="h-3 w-24"/><Block className="h-10 w-4/5"/><Block className="h-5 w-36"/><Block className="h-9 w-44"/><Block className="h-px w-full rounded-none"/><Block className="h-12 w-full"/><Block className="h-12 w-full"/></div></div></main></div>}
function AdminTransitionSkeleton(){return <div className="flex min-h-screen bg-canvas"><div className="hidden w-[82px] bg-dark md:block"/><main className="min-w-0 flex-1 px-5 pb-8 pt-20 md:p-8"><Block className="h-3 w-40"/><Block className="mt-3 h-9 w-56"/><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4},(_,index)=><Block className="h-32 rounded-2xl" key={index}/>)}</div><div className="mt-6 grid gap-5 lg:grid-cols-2"><Block className="h-80 rounded-2xl"/><Block className="h-80 rounded-2xl"/></div></main></div>}
function Block({className=""}:{className?:string}){return <span aria-hidden="true" className={`skeleton block rounded-xl bg-[#e8eaed] ${className}`}/>;}
