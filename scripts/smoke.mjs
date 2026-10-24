// Post-deploy smoke test: every check asserts on content, not only on the HTTP status.
const base = (process.env.SMOKE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
let failed = 0;

async function check(name, run) {
  try { await run(); console.log(`✓ ${name}`); }
  catch (error) { failed++; console.error(`✗ ${name}: ${error.message}`); }
}
async function get(path, expectedStatus = 200) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  if (response.status !== expectedStatus) throw new Error(`esperado HTTP ${expectedStatus}, recebido ${response.status}`);
  return response;
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };

await check("health", async () => assert((await (await get("/api/health")).json()).data?.status === "healthy", "status diferente de healthy"));
await check("health não expõe detalhes internos", async () => { const data = (await (await get("/api/health")).json()).data; assert(!("database" in data) && !("runtime" in data), "caminho do banco ou versão expostos"); });
await check("catálogo com marcas e categorias", async () => { const data = (await (await get("/api/catalog")).json()).data; assert(data.brands?.length && data.categories?.length, "catálogo vazio"); });
let slug = "";
await check("listagem de produtos sem custo", async () => {
  const item = (await (await get("/api/products?limit=1")).json()).data.items?.[0];
  assert(item, "nenhum produto publicado");
  assert(!("cost_cents" in item), "cost_cents exposto na API pública");
  slug = item.slug;
});
await check("página de produto renderiza", async () => { assert(slug, "sem produto para abrir"); const html = await (await get(`/produto/${slug}`)).text(); assert(html.includes("<html") && html.includes("Ridekit"), "HTML inesperado"); });
await check("home renderiza", async () => assert((await (await get("/")).text()).includes("Ridekit"), "marca ausente no HTML"));
await check("catálogo renderiza", async () => assert((await (await get("/capacetes")).text()).includes("<main"), "sem conteúdo principal"));
await check("rota inexistente responde 404", async () => { await get("/pagina-que-nao-existe-smoke", 404); });
await check("produto inexistente responde 404", async () => { await get("/produto/produto-que-nao-existe-smoke", 404); });
await check("robots.txt", async () => assert((await (await get("/robots.txt")).text()).toLowerCase().includes("user-agent"), "robots.txt inválido"));
await check("sitemap.xml", async () => assert((await (await get("/sitemap.xml")).text()).includes("<urlset"), "sitemap inválido"));
await check("cabeçalhos de segurança", async () => { const headers = (await get("/")).headers; for (const name of ["x-content-type-options", "x-frame-options", "strict-transport-security", "content-security-policy"]) assert(headers.get(name), `${name} ausente`); });

for (const [name, path] of [["conta do cliente", "/api/account"], ["pagamento Pix", "/api/payments/pix?order_id=1"], ["pedidos (admin)", "/api/orders"], ["dashboard (admin)", "/api/dashboard"]]) {
  await check(`${name} protegido`, async () => { await get(path, 401); });
}

if (failed) { console.error(`\n${failed} verificação(ões) falharam em ${base}`); process.exitCode = 1; }
