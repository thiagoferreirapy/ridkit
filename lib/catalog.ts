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

export const adminSections = [
    "Dashboard", "Produtos", "Categorias", "Tabela de medidas", "Marcas", "Estoque", "Pedidos", "Frete regional", "Vendas WhatsApp",
    "Clientes", "Cupons", "Avaliações", "Banners", "Mensagens", "Campanhas", "E-mails", "Newsletter", "Segurança", "Configurações", "Equipe",
];

export const routeMap = [
  ["/", "Home"], ["/capacetes", "Categoria / PLP"], ["/produto/ls2-ff358-pro-mono", "Produto / PDP"],
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
