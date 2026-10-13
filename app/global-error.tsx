"use client";

// Replaces the root layout when it fails, so it cannot rely on globals.css or providers.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f5", color: "#1f1f1f" }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 32, background: "#fff", borderRadius: 8, textAlign: "center" }}>
          <h1 style={{ fontSize: 22 }}>A loja está temporariamente indisponível</h1>
          <p style={{ color: "#6a6a6a", fontSize: 14 }}>Tente novamente em alguns instantes.</p>
          <button onClick={reset} style={{ marginTop: 16, minHeight: 44, padding: "0 20px", border: 0, borderRadius: 6, background: "#a65200", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Tentar novamente</button>
          {error.digest && <p style={{ marginTop: 20, fontSize: 12, color: "#6a6a6a" }}>Código do erro: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
