import { expect,test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home e catálogo funcionam no desktop e mobile",async({page})=>{
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await page.goto("/capacetes");
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("WhatsApp adiciona uma ação sem substituir o carrinho",async({page})=>{
  await page.route("**/api/store-settings",route=>route.fulfill({json:{data:{
    store_name:"Ridekit",purchase_mode:"whatsapp",whatsapp_number:"5511999999999",
    whatsapp_message_intro:"Olá! Quero finalizar esta compra na Ridekit.",free_shipping_threshold_cents:29900,
    standard_shipping_cents:1990,express_shipping_cents:2990,pix_discount_percent:5,max_installments:10,
    topbar_message:"Frete grátis acima de R$ 299",welcome_email_subject:"Bem-vindo",welcome_email_html:"<p>Bem-vindo à loja Ridekit.</p>"
  }}}));
  await page.goto("/capacetes");
  const card=page.locator("article").first();
  await expect(card.getByRole("link",{name:/Adicionar .* ao carrinho/})).toBeVisible();
  const whatsapp=card.getByRole("link",{name:/Comprar .* pelo WhatsApp/});
  await expect(whatsapp).toBeVisible();
  await expect(whatsapp.locator('svg[data-icon="whatsapp"]')).toBeVisible();
  await expect(whatsapp).toHaveAttribute("href",/^https:\/\/wa\.me\/5511999999999\?text=/);
  await expect.poll(async()=>{
    const href=await whatsapp.getAttribute("href");
    return new URL(href!).searchParams.get("text")||"";
  }).toContain("Link do produto: http://127.0.0.1:3000/produto/");
  const message=new URL((await whatsapp.getAttribute("href"))!).searchParams.get("text")||"";
  expect(message).toContain("*Produto:");
  expect(message).toContain("Marca:");
  expect(message).toContain("Categoria:");
  expect(message).toContain("Valor: R$");
  expect(message).toContain("Tamanhos disponíveis:");
  expect(message).toContain("Condições:");
  expect(message).toContain("Disponibilidade: em estoque");
});

test("troca de página leva o scroll para o topo",async({page})=>{
  await page.goto("/");
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  await page.locator('a[href^="/capacetes"]').first().click();
  await expect(page).toHaveURL(/\/capacetes/);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
});

test("menu mobile e carrinho abrem e fecham com transição lateral",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="mobile","Validação específica dos painéis no celular");
  await page.goto("/");
  await page.getByRole("button",{name:"Abrir menu"}).click();
  const menu=page.getByRole("dialog",{name:"Menu de navegação"});
  await expect(menu).toBeVisible();
  await expect(menu).toHaveClass(/transition-transform/);
  const menuWidth=await menu.evaluate(element=>element.getBoundingClientRect().width);
  const viewportWidth=await page.evaluate(()=>window.innerWidth);
  expect(Math.abs(menuWidth-viewportWidth)).toBeLessThanOrEqual(1);
  await menu.getByRole("button",{name:"Fechar"}).click();
  await expect(menu).toHaveCount(0);
  await page.getByRole("button",{name:/Carrinho com/}).click();
  const cart=page.getByRole("dialog",{name:"Carrinho"});
  await expect(cart).toBeVisible();
  await expect(cart).toHaveClass(/transition-transform/);
  await cart.getByRole("button",{name:"Fechar"}).click();
  await expect(cart).toHaveCount(0);
});

test("páginas públicas não têm violações críticas de acessibilidade",async({page})=>{
  for(const path of ["/","/capacetes","/login"]){
    await page.goto(path);
    const results=await new AxeBuilder({page}).disableRules(["color-contrast"]).analyze();
    expect(results.violations.filter(item=>item.impact==="critical")).toEqual([]);
  }
});

test("login administrativo não exibe opções removidas",async({page})=>{
  await page.goto("/admin/login");
  await expect(page.getByRole("heading",{name:"Acessar o painel"})).toBeVisible();
  await expect(page.getByText("Resumo de hoje")).toHaveCount(0);
  await expect(page.getByText("Manter conectado por 30 dias")).toHaveCount(0);
  await expect(page.getByText("Uma verificação adicional poderá ser solicitada.")).toHaveCount(0);
});

test("admin usa menu lateral no celular",async({page},testInfo)=>{
  test.skip(testInfo.project.name!=="mobile","Validação específica do menu mobile");
  await page.goto("/admin/login");
  await page.getByLabel("E-mail corporativo").fill("admin@ridekit.com.br");
  await page.getByRole("textbox", { name: /Senha/ }).fill("Admin123!");
  await page.getByRole("button",{name:"Entrar no painel"}).click();
  if(await page.getByRole("heading",{name:"Verificação em duas etapas"}).isVisible().catch(()=>false))test.skip(true,"2FA ativo nesta conta");
  await expect(page.getByRole("button",{name:"Abrir menu administrativo"})).toBeVisible();
  await page.getByRole("button",{name:"Abrir menu administrativo"}).click();
  await expect(page.getByRole("navigation").getByRole("link",{name:"Dashboard"})).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link",{name:"Segurança"})).toBeVisible();
  await page.getByRole("navigation").getByRole("link",{name:"Equipe"}).click();
  await expect(page.getByRole("heading",{name:"Equipe"})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Cadastrar administrador"})).toBeVisible();
});
