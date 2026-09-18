import { expect,test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home e catálogo funcionam no desktop e mobile",async({page})=>{
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await page.goto("/capacetes");
  await expect(page.getByRole("heading").first()).toBeVisible();
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
