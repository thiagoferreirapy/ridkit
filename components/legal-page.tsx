"use client";

import { LEGAL_VERSION, PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal-documents";

export function LegalPage({kind}:{kind:"privacy"|"terms"}) {
  const document=kind==="privacy"?PRIVACY_POLICY:TERMS_OF_USE;
  const blocks=document.split(/\n\s*\n/).map(block=>block.trim()).filter(Boolean);
  return <main className="container-page max-w-4xl py-10 md:py-16">
    <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="note">
      A identificação e os canais oficiais da empresa ainda precisam ser preenchidos nos campos entre colchetes antes da publicação definitiva. Este texto também precisa de revisão jurídica.
    </div>
    <article className="card p-6 md:p-10">
      {blocks.map((block,index)=>{
        if(index===0)return <h1 className="text-3xl font-semibold leading-tight" key={index}>{block}</h1>;
        if(/^\d+(?:\.\d+)*\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(block))return <h2 className="mt-9 text-xl font-semibold" key={index}>{block}</h2>;
        if(block.startsWith("* "))return <ul className="ml-6 list-disc space-y-2 text-sm leading-7 text-muted" key={index}>{block.split("\n").map((item,i)=><li key={i}>{item.replace(/^\*\s*/,"")}</li>)}</ul>;
        return <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted" key={index}>{block}</p>;
      })}
    </article>
    <p className="mt-5 text-xs text-muted">Versão registrada: {LEGAL_VERSION}</p>
  </main>;
}
