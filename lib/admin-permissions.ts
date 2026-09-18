export const adminPermissionDefinitions = [
  ["dashboard.view", "Dashboard", "Visualizar indicadores e relatórios"],
  ["catalog.view", "Catálogo", "Visualizar produtos, categorias, marcas e banners"],
  ["catalog.manage", "Catálogo", "Criar e editar o catálogo"],
  ["inventory.view", "Estoque", "Consultar estoque e movimentações"],
  ["inventory.manage", "Estoque", "Ajustar estoque e reservas"],
  ["orders.view", "Pedidos", "Consultar pedidos e pagamentos"],
  ["orders.manage", "Pedidos", "Alterar pedidos, frete e pagamentos"],
  ["customers.view", "Atendimento", "Consultar clientes, avaliações e mensagens"],
  ["customers.manage", "Atendimento", "Responder e moderar atendimentos"],
  ["marketing.view", "Marketing", "Consultar cupons, campanhas e newsletter"],
  ["marketing.manage", "Marketing", "Gerenciar cupons, campanhas e comunicações"],
  ["settings.manage", "Configurações", "Alterar configurações da loja"],
  ["admins.manage", "Equipe", "Cadastrar usuários e definir permissões"],
] as const;

export type AdminPermission = typeof adminPermissionDefinitions[number][0];
export type AdminRole = "admin" | "manager" | "support";
export const allAdminPermissions = adminPermissionDefinitions.map(([key])=>key);

export const rolePermissionDefaults:Record<AdminRole,AdminPermission[]> = {
  admin:[...allAdminPermissions],
  manager:allAdminPermissions.filter(key=>key!=="admins.manage"),
  support:["dashboard.view","orders.view","customers.view","customers.manage"],
};

const sectionPermissions:Record<string,AdminPermission>={
  Dashboard:"dashboard.view",Produtos:"catalog.view",Categorias:"catalog.view","Tabela de medidas":"catalog.view",Marcas:"catalog.view",Banners:"catalog.view",
  Estoque:"inventory.view",Pedidos:"orders.view","Frete regional":"orders.manage","Vendas WhatsApp":"customers.view",Clientes:"customers.view",Avaliações:"customers.view",Mensagens:"customers.view",
  Cupons:"marketing.view",Campanhas:"marketing.view","E-mails":"marketing.view",Newsletter:"marketing.view",Segurança:"dashboard.view",Configurações:"settings.manage",Equipe:"admins.manage",
};
export const permissionForAdminSection=(section:string)=>sectionPermissions[section]||"dashboard.view";
export const hasAdminPermission=(permissions:string[]|undefined,permission:AdminPermission)=>Boolean(permissions?.includes(permission));
export function permissionForResource(resource:string,manage=false):AdminPermission {if(["brands","categories","hero_slides","category_size_chart"].includes(resource))return manage?"catalog.manage":"catalog.view";if(["variants","inventory_movements"].includes(resource))return manage?"inventory.manage":"inventory.view";if(["customers","reviews","contact_messages"].includes(resource))return manage?"customers.manage":"customers.view";if(["coupons","newsletter_subscribers"].includes(resource))return manage?"marketing.manage":"marketing.view";return manage?"settings.manage":"dashboard.view";}
