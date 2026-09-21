import { expect,test } from "@playwright/test";

test("busca por marca seleciona o filtro e combina categoria e tamanho",async({page,request})=>{
  const catalog=(await (await request.get("/api/catalog")).json()).data;
  const brand=catalog.brands.find((item:{product_count:number})=>item.product_count>0);
  expect(brand).toBeTruthy();
  await page.goto(`/busca?q=${encodeURIComponent(brand.name)}`);
  await expect(page.getByLabel("Filtrar por marca")).toHaveValue(brand.slug);
  await expect(page).toHaveURL(new RegExp(`brand=${brand.slug}`));
  const products=(await (await request.get(`/api/products?q=${encodeURIComponent(brand.name)}&limit=100`)).json()).data.items;
  expect(products.length).toBeGreaterThan(0);
  expect(products.every((item:{brand_slug:string})=>item.brand_slug===brand.slug)).toBe(true);
  await page.getByLabel("Filtrar por categoria").selectOption(products[0].category_slug);
  await expect(page.getByLabel("Filtrar por marca")).toHaveValue(brand.slug);
  await expect(page).toHaveURL(new RegExp(`category=${products[0].category_slug}`));
  await page.goto(`/busca?brand=${brand.slug}&category=${products[0].category_slug}&size=inexistente&q=produto-inexistente`);
  await expect(page.getByRole("heading",{name:"Nenhum produto encontrado"})).toBeVisible();
});

test("buscar novamente mantém as sugestões de outras marcas",async({page,request})=>{
  const catalog=(await (await request.get("/api/catalog")).json()).data;
  const brands=catalog.brands.filter((item:{product_count:number})=>item.product_count>0);
  expect(brands.length).toBeGreaterThan(1);
  await page.goto("/");
  const open=()=>page.getByRole("button",{name:/Buscar capacetes|^Buscar$/}).filter({visible:true}).click();
  await open();
  await page.getByPlaceholder("O que você procura?").fill(brands[0].name);
  await page.getByPlaceholder("O que você procura?").press("Enter");
  await expect(page).toHaveURL(/\/busca/);
  await open();
  const popular=page.getByText("Buscas populares",{exact:true}).locator("..");
  await expect(popular.getByRole("button")).not.toHaveCount(1);
  await expect(popular.getByRole("button")).not.toHaveCount(0);
});

test("galeria de avaliações navega entre fotos e permite enviar foto para moderação",async({page,request})=>{
  const product=(await (await request.get("/api/products?limit=1")).json()).data.items[0];
  const detail=(await (await request.get(`/api/products/${product.slug}`)).json()).data;
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=","base64");
  const image=`data:image/png;base64,${png.toString("base64")}`;
  await page.route("**/api/auth/me",route=>route.fulfill({json:{data:{user:{id:999,name:"Cliente teste",email:"teste@example.com"}}}}));
  await page.route(`**/api/products/${product.slug}`,route=>route.fulfill({json:{data:{...detail,reviews:[{id:999,rating:5,title:"Ótimo capacete",comment:"Produto muito bom, conforme anunciado.",customer:"Cliente",images:[{url:image},{url:image}]}]}}}));
  await page.route("**/api/review-images",route=>route.fulfill({status:201,json:{data:{url:"/uploads/reviews/test.png"}}}));
  await page.route("**/uploads/reviews/test.png",route=>route.fulfill({contentType:"image/png",body:png}));
  let submission:Record<string,unknown>|undefined;
  await page.route("**/api/reviews",route=>{submission=route.request().postDataJSON();return route.fulfill({status:201,json:{data:{message:"Avaliação enviada para moderação"}}});});
  await page.goto(`/produto/${product.slug}`);
  await page.getByRole("button",{name:"Abrir mídia 1 da avaliação"}).click();
  const gallery=page.getByRole("dialog",{name:"Galeria da avaliação"});
  await expect(gallery.getByText("1 de 2")).toBeVisible();
  await gallery.getByRole("button",{name:"Próxima mídia"}).click();
  await expect(gallery.getByText("2 de 2")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(gallery).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles({name:"foto.png",mimeType:"image/png",buffer:png});
  await expect(page.getByAltText("Prévia da avaliação")).toBeVisible();
  await page.getByPlaceholder("Conte sua experiência").fill("Gostei muito do produto e do acabamento.");
  await page.getByRole("button",{name:"Enviar para moderação"}).click();
  await expect(page.getByRole("status")).toHaveText("Avaliação enviada para moderação");
  expect(submission?.image_urls).toEqual(["/uploads/reviews/test.png"]);
});
