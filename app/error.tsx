"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="container-page grid min-h-[60vh] place-items-center py-16">
      <div className="card max-w-lg p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">Algo deu errado</p>
        <h1 className="mt-2 text-2xl font-bold">Não foi possível carregar esta página</h1>
        <p className="mt-3 text-sm text-muted">Tente novamente em alguns segundos. Se o problema continuar, fale com o nosso suporte.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="focus-ring inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-bold text-white hover:bg-accent-strong">Tentar novamente</button>
          <Link href="/" className="focus-ring inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-5 text-sm font-bold">Ir para a página inicial</Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-muted">Código do erro: {error.digest}</p>}
      </div>
    </main>
  );
}
