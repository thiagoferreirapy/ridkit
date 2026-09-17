import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dbPath = process.env.DATABASE_PATH || path.join(root, "data", "ridekit.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath, { timeout: 5000 });
db.exec(fs.readFileSync(path.join(root, "data", "schema.sql"), "utf8"));
const categoryColumns=db.prepare("PRAGMA table_info(categories)").all();
if(!categoryColumns.some(column=>column.name==="variation_type"))db.exec("ALTER TABLE categories ADD COLUMN variation_type TEXT NOT NULL DEFAULT 'none' CHECK(variation_type IN ('none','size','option'))");
if(!categoryColumns.some(column=>column.name==="variation_label"))db.exec("ALTER TABLE categories ADD COLUMN variation_label TEXT");
const productColumns=db.prepare("PRAGMA table_info(products)").all();
if(!productColumns.some(column=>column.name==="is_new"))db.exec("ALTER TABLE products ADD COLUMN is_new INTEGER NOT NULL DEFAULT 0 CHECK(is_new IN (0,1))");
if(!productColumns.some(column=>column.name==="launch_starts_at"))db.exec("ALTER TABLE products ADD COLUMN launch_starts_at TEXT");
if(!productColumns.some(column=>column.name==="launch_ends_at"))db.exec("ALTER TABLE products ADD COLUMN launch_ends_at TEXT");
if(!productColumns.some(column=>column.name==="offer_starts_at"))db.exec("ALTER TABLE products ADD COLUMN offer_starts_at TEXT");
if(!productColumns.some(column=>column.name==="offer_ends_at"))db.exec("ALTER TABLE products ADD COLUMN offer_ends_at TEXT");

const image = (id, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=82`;
const photos = [
  ["photo-1705162815217-d01650b9c542", "Cristian Martinez", "https://unsplash.com/@cristianm"],
  ["photo-1558981806-ec527fa84c39", "Harley-Davidson", "https://unsplash.com/@harleydavidson"],
  ["photo-1558981359-219d6364c9c8", "Harley-Davidson", "https://unsplash.com/@harleydavidson"],
  ["photo-1558981403-c5f9899a28bc", "Harley-Davidson", "https://unsplash.com/@harleydavidson"],
  ["photo-1524591652733-73fa1ae7b5ee", "Harley-Davidson", "https://unsplash.com/@harleydavidson"],
  ["photo-1568772585407-9361f9bf3a87", "Harley-Davidson", "https://unsplash.com/@harleydavidson"],
  ["photo-1591637333184-19aa84b3e01f", "Unsplash contributor", "https://unsplash.com"],
  ["photo-1547549082-6bc09f2049ae", "Unsplash contributor", "https://unsplash.com"],
  ["photo-1609630875171-b1321377ee65", "Unsplash contributor", "https://unsplash.com"],
  ["photo-1622185135505-2d795003994a", "Unsplash contributor", "https://unsplash.com"],
];

const brands = [
  ["LS2", "ls2", "Espanha"], ["Norisk", "norisk", "Brasil"], ["ASX", "asx", "Brasil"],
  ["Axxis", "axxis", "Espanha"], ["KYT", "kyt", "Indonésia"], ["Shoei", "shoei", "Japão"],
  ["AGV", "agv", "Itália"], ["Bell", "bell", "Estados Unidos"],
];
const categories = [
  ["Capacetes fechados", "fechados"], ["Capacetes articulados", "articulados"],
  ["Capacetes abertos", "abertos"], ["Capacetes off-road", "off-road"],
  ["Acessórios", "acessorios"], ["Equipamentos", "equipamentos"],
];
const modelNames = [
  "FF358 Pro Mono", "Razor Solid", "Draken Vector", "Stream II", "City Solid", "Vector II",
  "R2R Plain", "NXR2", "K1 S", "Qualifier", "Advant X", "MX701 Explorer",
  "FF800 Storm II", "Motion", "Eagle", "Atom SV", "TT Course", "Glamster",
  "K3 Rossi", "SRT Modular", "FF353 Rapid", "Route FF", "Ares", "Race R Pro",
  "Viseira Fumê", "Intercom Pro", "Balaclava Dry", "Luva Urban", "Jaqueta Route",
  "Bota Adventure", "Protetor de coluna", "Capa impermeável",
];
const colors = ["Preto fosco", "Preto brilhante", "Cinza titânio", "Branco", "Vermelho", "Azul marinho"];
const comments = [
  "Ótimo acabamento e ajuste firme. A entrega foi muito rápida.",
  "Segui o guia de tamanho e serviu perfeitamente.",
  "Produto original, bem embalado e com nota fiscal.",
  "Muito confortável na estrada e com boa ventilação.",
  "Excelente custo-benefício. Voltaria a comprar.",
  "O atendimento ajudou bastante na escolha do tamanho.",
];

function id(result) { return Number(result.lastInsertRowid); }
function slug(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

db.exec("BEGIN IMMEDIATE");
try {
  for (const table of ["reviews","order_events","order_items","orders","search_history","favorite_items","cart_items","carts","addresses","refresh_tokens","customers","admin_refresh_tokens","admin_users","coupons","product_variants","product_images","products","hero_slides","categories","brands"]) db.exec(`DELETE FROM ${table}`);
  db.exec("DELETE FROM sqlite_sequence");

  const brandInsert = db.prepare("INSERT INTO brands(name,slug,country,description) VALUES(?,?,?,?)");
  const brandIds = brands.map(([name, brandSlug, country]) => id(brandInsert.run(name, brandSlug, country, `${name}: tecnologia e proteção selecionadas pela Ridekit.`)));
  const categoryInsert = db.prepare("INSERT INTO categories(name,slug,description,image_url) VALUES(?,?,?,?)");
  const categoryIds = categories.map(([name, categorySlug], i) => id(categoryInsert.run(name, categorySlug, `Seleção de ${name.toLowerCase()} para diferentes estilos de pilotagem.`, image(photos[i % photos.length][0]))));

  const heroInsert = db.prepare("INSERT INTO hero_slides(badge,title,description,image_url,mobile_image_url,cta_label,cta_url,secondary_label,secondary_url,sort_order,active) VALUES(?,?,?,?,?,?,?,?,?,?,1)");
  [
    ["Seleção Ridekit","Proteção para cada rota.","Capacetes, equipamentos e acessórios com procedência, garantia e suporte especializado.",image(photos[1][0],1600),image(photos[1][0],900),"Ver capacetes","/capacetes","Ofertas da semana","/ofertas",0],
    ["Frete e condições","Seu próximo equipamento começa aqui.","Frete grátis acima de R$ 299, parcelamento em até 10x e 5% de desconto no Pix.",image(photos[2][0],1600),image(photos[2][0],900),"Explorar a loja","/capacetes","Guia de tamanho","/guia-de-tamanho",1],
    ["Novidades","Pilotagem com mais confiança.","Encontre o tamanho certo, acompanhe seu pedido e conte com atendimento humano quando precisar.",image(photos[0][0],1600),image(photos[0][0],900),"Conhecer produtos","/capacetes",null,null,2],
  ].forEach(slide => heroInsert.run(...slide));

  db.exec("UPDATE categories SET variation_type='size',variation_label='Tamanho' WHERE slug IN ('fechados','articulados','abertos','off-road')");
  const productInsert = db.prepare(`INSERT INTO products(brand_id,category_id,name,slug,sku,description,price_cents,compare_at_cents,cost_cents,color,finish,shell_material,weight_grams,solar_visor,pinlock_ready,featured,rating,review_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const imageInsert = db.prepare("INSERT INTO product_images(product_id,url,alt,photographer,photographer_url,position) VALUES(?,?,?,?,?,?)");
  const variantInsert = db.prepare("INSERT INTO product_variants(product_id,sku,size,color,stock,reserved_stock,price_cents) VALUES(?,?,?,?,?,?,?)");
  const productIds = [];
  for (let i = 0; i < modelNames.length; i++) {
    const name = modelNames[i]; const brandIndex = i % brandIds.length; const accessory = i >= 24;
    const categoryIndex = accessory ? (i % 2 ? 5 : 4) : i % 4;
    const price = accessory ? 6990 + (i - 24) * 12900 : 55990 + (i % 10) * 11500;
    const productSlug = `${brands[brandIndex][1]}-${slug(name)}`;
    const productId = id(productInsert.run(brandIds[brandIndex], categoryIds[categoryIndex], name, productSlug, `RK-${String(i + 1).padStart(4,"0")}`, `${name} com seleção Ridekit, descrição técnica clara, garantia e suporte especializado.`, price, i % 4 === 2 ? Math.round(price * 1.14) : null, Math.round(price * .58), colors[i % colors.length], i % 2 ? "Brilhante" : "Fosco", accessory ? "Têxtil técnico" : i % 3 ? "KPA / termoplástico" : "Fibra composta", accessory ? 350 : 1420 + (i % 6) * 45, i % 3 === 0 ? 1 : 0, i % 2 === 0 ? 1 : 0, i < 8 ? 1 : 0, 4.6 + (i % 4) / 10, 8 + i));
    productIds.push(productId);
    for (let p = 0; p < 2; p++) { const photo = photos[(i + p) % photos.length]; imageInsert.run(productId, image(photo[0]), `${name} — foto ${p + 1}`, photo[1], photo[2], p); }
    const sizes = accessory ? ["Único"] : ["56 / S", "58 / M", "60 / L", "62 / XL"];
    for (let s = 0; s < sizes.length; s++) variantInsert.run(productId, `RK-${String(i + 1).padStart(4,"0")}-${s + 1}`, sizes[s], colors[i % colors.length], (i * 7 + s * 3) % 22, s % 2, price);
  }
  db.prepare(`UPDATE products SET is_new=1,launch_starts_at=datetime('now','-1 day'),launch_ends_at=datetime('now','+45 days') WHERE id IN (${productIds.slice(-8).map(()=>"?").join(",")})`).run(...productIds.slice(-8));

  const customerInsert = db.prepare("INSERT INTO customers(name,email,cpf,phone,password_hash) VALUES(?,?,?,?,?)");
  const addressInsert = db.prepare("INSERT INTO addresses(customer_id,label,zip_code,street,number,complement,district,city,state,is_default) VALUES(?,?,?,?,?,?,?,?,?,?)");
  const customerNames = ["Carlos Silva","Ana Lima","João Souza","Camila Rocha","Rodrigo Alves","Marina Costa","Lucas Martins","Beatriz Melo","Felipe Santos","Juliana Freitas","Rafael Nunes","Larissa Gomes"];
  const demoSalt=randomBytes(16).toString("hex"); const demoPassword=`${demoSalt}:${scryptSync("Ridekit123!",demoSalt,64).toString("hex")}`;
  const adminSalt=randomBytes(16).toString("hex"); const adminPassword=`${adminSalt}:${scryptSync("Admin123!",adminSalt,64).toString("hex")}`;
  db.prepare("INSERT INTO admin_users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run("Administrador Ridekit","admin@ridekit.com.br",adminPassword);
  const customerIds = customerNames.map((name, i) => {
    const customerId = id(customerInsert.run(name, `${slug(name)}@example.com`, `${String(10000000000 + i * 123457).padStart(11,"0")}`, `(11) 9${String(80000000 + i * 713).padStart(8,"0")}`, demoPassword));
    addressInsert.run(customerId, "Casa", `01${String(100 + i).padStart(3,"0")}-000`, "Rua das Pilotas", String(100 + i), i % 2 ? "Apto 42" : null, "Centro", i % 3 ? "São Paulo" : "Campinas", "SP", 1);
    return customerId;
  });

  const couponInsert = db.prepare("INSERT INTO coupons(code,description,discount_type,discount_value,min_order_cents,usage_limit,used_count,starts_at,ends_at,active) VALUES(?,?,?,?,?,?,?,?,?,?)");
  [["BEMVINDO10","10% na primeira compra","percent",10,29900],["PIX5","5% adicional no Pix","percent",5,0],["FRETEGRATIS","Frete grátis acima de R$ 299","shipping",0,29900],["RIDE50","R$ 50 em compras acima de R$ 800","fixed",5000,80000]].forEach((c,i)=>couponInsert.run(...c,500,15+i*8,"2026-01-01","2027-01-01",1));

  const orderInsert = db.prepare(`INSERT INTO orders(customer_id,coupon_id,order_number,status,payment_method,payment_status,subtotal_cents,discount_cents,shipping_cents,total_cents,shipping_method,shipping_address_json,tracking_code,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const orderItemInsert = db.prepare("INSERT INTO order_items(order_id,product_id,variant_id,product_name,variant_name,sku,unit_price_cents,quantity,total_cents) VALUES(?,?,?,?,?,?,?,?,?)");
  const eventInsert = db.prepare("INSERT INTO order_events(order_id,status,title,description,occurred_at) VALUES(?,?,?,?,?)");
  const statuses = ["paid","preparing","shipped","delivered","delivered","cancelled"];
  const payment = ["pix","credit_card","credit_card","pix"];
  const orderIds = [];
  for (let i = 0; i < 25; i++) {
    const productIndex = i % productIds.length;
    const product = db.prepare("SELECT id,name,sku,price_cents FROM products WHERE id=?").get(productIds[productIndex]);
    const variant = db.prepare("SELECT id,size,color,sku FROM product_variants WHERE product_id=? ORDER BY id LIMIT 1").get(product.id);
    const quantity = i % 5 === 0 ? 2 : 1; const subtotal = product.price_cents * quantity; const discount = i % 4 === 0 ? Math.round(subtotal * .05) : 0; const shipping = subtotal >= 29900 ? 0 : 1990; const status = statuses[i % statuses.length];
    const created = new Date(Date.UTC(2026, 7, 29 - i, 14, 32)).toISOString();
    const orderId = id(orderInsert.run(customerIds[i % customerIds.length], i % 4 === 0 ? 2 : null, `10${234 - i}`, status, payment[i % payment.length], status === "cancelled" ? "refunded" : "approved", subtotal, discount, shipping, subtotal - discount + shipping, shipping ? "Expressa" : "Econômica", JSON.stringify({street:"Rua das Pilotas",number:String(100+i),city:"São Paulo",state:"SP",zip_code:"01100-000"}), status === "shipped" || status === "delivered" ? `BR${String(123456789 + i)}RK` : null, created, created));
    orderIds.push(orderId); orderItemInsert.run(orderId, product.id, variant.id, product.name, `${variant.color} · ${variant.size}`, variant.sku, product.price_cents, quantity, subtotal);
    eventInsert.run(orderId,"paid","Pagamento aprovado","Pagamento confirmado com segurança.",created);
    if (["preparing","shipped","delivered"].includes(status)) eventInsert.run(orderId,"preparing","Pedido em preparação","Itens separados para envio.",created);
    if (["shipped","delivered"].includes(status)) eventInsert.run(orderId,"shipped","Pedido enviado","Objeto entregue à transportadora.",created);
    if (status === "delivered") eventInsert.run(orderId,"delivered","Pedido entregue","Entrega concluída.",created);
  }

  const reviewInsert = db.prepare("INSERT OR IGNORE INTO reviews(product_id,customer_id,order_id,rating,title,comment,verified,approved,created_at) VALUES(?,?,?,?,?,?,?,?,?)");
  for (let i = 0; i < 72; i++) reviewInsert.run(productIds[i % productIds.length], customerIds[i % customerIds.length], orderIds[i % orderIds.length], 4 + (i % 5 === 0 ? 0 : 1), i % 3 === 0 ? "Excelente escolha" : "Compra verificada", comments[i % comments.length], 1, 1, new Date(Date.UTC(2026, 7, 28 - (i % 28))).toISOString());
  db.exec(`UPDATE products SET rating = COALESCE((SELECT ROUND(AVG(rating),1) FROM reviews WHERE product_id=products.id), rating), review_count = (SELECT COUNT(*) FROM reviews WHERE product_id=products.id)`);

  const cartInsert = db.prepare("INSERT INTO carts(customer_id,session_id,coupon_id) VALUES(?,?,?)");
  const cartItemInsert = db.prepare("INSERT INTO cart_items(cart_id,variant_id,quantity) VALUES(?,?,?)");
  for (let i = 0; i < 6; i++) { const cartId = id(cartInsert.run(i < 3 ? customerIds[i] : null, `demo-session-${i+1}`, i===0?1:null)); const variant = db.prepare("SELECT id FROM product_variants ORDER BY id LIMIT 1 OFFSET ?").get(i*3); cartItemInsert.run(cartId, variant.id, i%2+1); }

  db.exec("COMMIT");
  const counts = {}; for (const table of ["brands","categories","products","product_variants","product_images","customers","orders","order_items","reviews","coupons","carts"]) counts[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  console.log(JSON.stringify({ ok: true, database: dbPath, counts }, null, 2));
} catch (error) { db.exec("ROLLBACK"); throw error; }
finally { db.close(); }
