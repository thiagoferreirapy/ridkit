export type Product = {
  id?: number;
  slug: string;
  brand: string;
  name: string;
  price: string;
  oldPrice?: string;
  tone: string;
  tag?: string;
  image?: string;
  photographer?: string;
  priceCents?: number;
  compareAtCents?: number;
  category?: string;
  sizes?: string[];
  availableStock?: number;
};

const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=82`;
const helmetSizes = ["56 / S", "58 / M", "60 / L", "62 / XL"];

export const products: Product[] = [
  { slug: "ls2-ff358-pro", brand: "LS2", name: "FF358 Pro Mono", price: "R$ 899,90", tone: "from-zinc-950 to-zinc-700", tag: "MAIS VENDIDO", image: unsplash("photo-1705162815217-d01650b9c542"), photographer: "Cristian Martinez", sizes:helmetSizes },
  { slug: "norisk-razor", brand: "NORISK", name: "Razor Solid", price: "R$ 749,90", tone: "from-neutral-800 to-orange-950", image: unsplash("photo-1558981806-ec527fa84c39"), photographer: "Harley-Davidson", sizes:helmetSizes },
  { slug: "ls2-draken", brand: "LS2", name: "Draken", price: "R$ 629,90", oldPrice: "R$ 699,90", tone: "from-slate-900 to-slate-600", tag: "OFERTA", image: unsplash("photo-1558981359-219d6364c9c8"), photographer: "Harley-Davidson", sizes:helmetSizes },
  { slug: "ls2-stream-ii", brand: "LS2", name: "Stream II", price: "R$ 1.299,90", tone: "from-zinc-900 to-red-950", image: unsplash("photo-1558981403-c5f9899a28bc"), photographer: "Harley-Davidson", sizes:helmetSizes },
  { slug: "asx-city", brand: "ASX", name: "City Solid", price: "R$ 559,90", tone: "from-stone-800 to-stone-500", image: unsplash("photo-1524591652733-73fa1ae7b5ee"), photographer: "Harley-Davidson", sizes:helmetSizes },
  { slug: "axxis-draken", brand: "AXXIS", name: "Draken Vector", price: "R$ 699,90", tone: "from-neutral-950 to-orange-800", image: unsplash("photo-1568772585407-9361f9bf3a87"), photographer: "Harley-Davidson", sizes:helmetSizes },
  { slug: "kyt-r2r", brand: "KYT", name: "R2R Plain", price: "R$ 1.149,90", tone: "from-slate-950 to-blue-950", image: unsplash("photo-1591637333184-19aa84b3e01f"), photographer: "Unsplash contributor", sizes:helmetSizes },
  { slug: "shoei-nxr2", brand: "SHOEI", name: "NXR2", price: "R$ 3.499,90", tone: "from-zinc-900 to-zinc-500", tag: "PREMIUM", image: unsplash("photo-1609630875171-b1321377ee65"), photographer: "Unsplash contributor", sizes:helmetSizes },
];

export const adminSections = [
    "Dashboard", "Produtos", "Categorias", "Tabela de medidas", "Marcas", "Estoque", "Pedidos", "Frete regional", "Vendas WhatsApp",
    "Clientes", "Cupons", "Avaliações", "Banners", "Mensagens", "Campanhas", "E-mails", "Newsletter", "Segurança", "Configurações", "Equipe",
];

export const routeMap = [
  ["/", "Home"], ["/capacetes", "Categoria / PLP"], ["/produto/ls2-ff358-pro", "Produto / PDP"],
  ["/marcas", "Marcas"], ["/marcas/ls2", "Landing LS2"], ["/ofertas", "Ofertas"],
  ["/carrinho", "Carrinho"], ["/login", "Entrar e cadastrar"],
  ["/checkout", "Carrinho revisado"], ["/checkout/identificacao", "Identificação"],
  ["/checkout/endereco", "Endereço"], ["/checkout/entrega", "Entrega"],
  ["/checkout/pagamento", "Pagamento"], ["/checkout/pix", "Pix aguardando"],
  ["/checkout/erro", "Falha no cartão"], ["/checkout/sucesso", "Pedido confirmado"],
  ["/conta", "Visão geral"], ["/conta/pedidos", "Pedidos"], ["/conta/pedidos/10234", "Detalhe do pedido"],
  ["/conta/favoritos", "Favoritos"], ["/conta/enderecos", "Endereços"],
  ["/ajuda", "Central de ajuda"], ["/ajuda/devolucoes", "Trocas e devoluções"],
  ["/sobre", "Sobre a Ridekit"], ["/contato", "Contato"], ["/entrega", "Frete e entrega"],
  ["/garantia", "Garantia e segurança"], ["/privacidade", "Privacidade"], ["/termos", "Termos"],
  ["/guia-de-tamanho", "Guia de tamanho"], ["/admin", "Admin dashboard"],
  ["/admin/produtos", "Admin produtos"], ["/admin/produtos/editar", "Admin editar produto"],
  ["/admin/estoque", "Admin estoque"], ["/admin/pedidos", "Admin pedidos"], ["/admin/frete-regional", "Admin frete regional"],
  ["/admin/clientes", "Admin clientes e cupons"], ["/admin/categorias", "Admin categorias e marcas"],
  ["/admin/avaliacoes", "Admin avaliações"], ["/admin/configuracoes", "Admin configurações"],
] as const;
