"use client";

import { useShop } from "@/components/shop-state";
import { LEGAL_VERSION, PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal-documents";
import { fillLegalDocument } from "@/lib/store-info";

export function LegalPage({kind}:{kind:"privacy"|"terms"}) {
  const {settings}=useShop();
  const {text:document,missing}=fillLegalDocument(kind==="privacy"?PRIVACY_POLICY:TERMS_OF_USE,settings);
  const blocks=document.split(/\n\s*\n/).map(block=>block.trim()).filter(Boolean);
  return <section className="container-page max-w-4xl py-10 md:py-16">
    {missing.length>0&&<div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="note">
      Ainda faltam dados da empresa neste documento ({missing.join(", ")}). Eles são preenchidos em Admin → Dados da loja.
    </div>}
    <article className="card p-6 md:p-10">
      {blocks.map((block,index)=>{
        if(index===0)return <h1 className="text-3xl font-semibold leading-tight" key={index}>{block}</h1>;
        if(/^\d+(?:\.\d+)*\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(block))return <h2 className="mt-9 text-xl font-semibold" key={index}>{block}</h2>;
        if(block.startsWith("* "))return <ul className="ml-6 list-disc space-y-2 text-sm leading-7 text-muted" key={index}>{block.split("\n").map((item,i)=><li key={i}>{item.replace(/^\*\s*/,"")}</li>)}</ul>;
        return <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted" key={index}>{block}</p>;
      })}
    </article>
    <p className="mt-5 text-xs text-muted">Versão registrada: {LEGAL_VERSION}</p>
  </section>;
}
