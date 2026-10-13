// Paths rendered by StorePage (components/pages.tsx). Kept here so the server can answer 404 for
// anything else instead of a 200 "page not found" shell; update both when adding a page.
const exact = new Set([
  "/", "/capacetes", "/busca", "/ofertas", "/lancamentos", "/categorias", "/carrinho", "/conta-encerrada",
  "/login", "/recuperar-senha", "/redefinir-senha", "/marcas", "/conta", "/privacidade", "/termos",
  "/sobre", "/contato", "/entrega", "/garantia", "/guia-de-tamanho", "/ajuda", "/ajuda/devolucoes", "/mapa",
]);
const prefixes = ["/produto/", "/marcas/", "/conta/", "/admin", "/checkout"];

export function isKnownStorePath(path: string) {
  return exact.has(path) || prefixes.some(prefix => path.startsWith(prefix));
}
