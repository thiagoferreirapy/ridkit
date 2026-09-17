PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  country TEXT,
  description TEXT,
  logo_url TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  variation_type TEXT NOT NULL DEFAULT 'none' CHECK(variation_type IN ('none','size','option')),
  variation_label TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  compare_at_cents INTEGER CHECK(compare_at_cents IS NULL OR compare_at_cents >= price_cents),
  cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(cost_cents >= 0),
  color TEXT NOT NULL,
  finish TEXT,
  shell_material TEXT,
  weight_grams INTEGER,
  solar_visor INTEGER NOT NULL DEFAULT 0 CHECK(solar_visor IN (0,1)),
  pinlock_ready INTEGER NOT NULL DEFAULT 0 CHECK(pinlock_ready IN (0,1)),
  featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT NOT NULL,
  photographer TEXT,
  photographer_url TEXT,
  position INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  size TEXT NOT NULL,
  color TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  reserved_stock INTEGER NOT NULL DEFAULT 0 CHECK(reserved_stock >= 0),
  price_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(product_id, size, color)
) STRICT;

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cpf TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT,
  email_verified_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  replaced_by_hash TEXT,
  user_agent TEXT,
  ip_address TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','manager','support')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS admin_refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Casa',
  zip_code TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  district TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1))
) STRICT;

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percent','fixed','shipping')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  min_order_cents INTEGER NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
) STRICT;

CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  session_id TEXT UNIQUE,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  UNIQUE(cart_id, variant_id)
) STRICT;

CREATE TABLE IF NOT EXISTS favorite_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, product_id)
) STRICT;

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  searched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, query)
) STRICT;

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('pending','paid','preparing','shipped','delivered','cancelled','refunded')),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('pix','credit_card','two_cards')),
  payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','approved','failed','refunded')),
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  shipping_rule_id INTEGER,
  shipping_rule_name TEXT,
  total_cents INTEGER NOT NULL,
  shipping_method TEXT NOT NULL,
  shipping_address_json TEXT NOT NULL,
  tracking_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER NOT NULL REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  total_cents INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 1 CHECK(verified IN (0,1)),
  approved INTEGER NOT NULL DEFAULT 1 CHECK(approved IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, customer_id)
) STRICT;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT,
  html TEXT NOT NULL,
  segment TEXT NOT NULL CHECK(segment IN ('all','new','old','period')),
  segment_days INTEGER,
  period_start TEXT,
  period_end TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','partial','failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS newsletter_campaign_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  subscriber_id INTEGER NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sent','failed')),
  provider_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, subscriber_id)
) STRICT;

CREATE TABLE IF NOT EXISTS hero_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  badge TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  cta_label TEXT NOT NULL DEFAULT 'Ver oferta',
  cta_url TEXT NOT NULL DEFAULT '/ofertas',
  secondary_label TEXT,
  secondary_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS free_shipping_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cep_prefix TEXT,
  district TEXT,
  city TEXT,
  state TEXT,
  applies_to TEXT NOT NULL DEFAULT 'standard' CHECK(applies_to IN ('standard','all')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(cep_prefix IS NOT NULL OR district IS NOT NULL OR city IS NOT NULL OR state IS NOT NULL)
) STRICT;

CREATE TABLE IF NOT EXISTS whatsapp_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_number TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_zip_code TEXT,
  shipping_rule_id INTEGER,
  shipping_rule_name TEXT,
  notes TEXT,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  items_count INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','converted','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

INSERT OR IGNORE INTO store_settings(key,value) VALUES
  ('store_name','Ridekit'),
  ('purchase_mode','site'),
  ('whatsapp_number','5511999999999'),
  ('whatsapp_message_intro','Olá! Quero finalizar esta compra na Ridekit.'),
  ('free_shipping_threshold_cents','29900'),
  ('standard_shipping_cents','1990'),
  ('express_shipping_cents','2990'),
  ('pix_discount_percent','5'),
  ('max_installments','10'),
  ('topbar_message','Frete grátis acima de R$ 299 · 10x sem juros · 5% no Pix'),
  ('welcome_email_subject','Bem-vindo à {{store_name}}'),
  ('welcome_email_html','<p style="margin:28px 0 8px;font-size:13px;font-weight:700;color:#ff4d00;text-transform:uppercase;letter-spacing:1.5px">Conta confirmada</p><h1 style="margin:0;font-size:28px;line-height:36px">A estrada começa aqui, {{name}}.</h1><p style="margin:16px 0;color:#626975;font-size:15px;line-height:24px">Seu e-mail foi validado e sua conta está pronta. Agora você pode salvar favoritos, acompanhar pedidos e finalizar compras com seus dados preenchidos.</p><a href="{{home_url}}" style="display:inline-block;margin-top:8px;padding:14px 22px;border-radius:10px;background:#0b0d10;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Explorar a {{store_name}}</a>');

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_featured ON products(active, featured);
CREATE INDEX IF NOT EXISTS idx_variants_product_stock ON product_variants(product_id, stock);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, approved);
CREATE INDEX IF NOT EXISTS idx_favorites_session ON favorite_items(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_customer ON refresh_tokens(customer_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_admin_refresh_tokens_admin ON admin_refresh_tokens(admin_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_customer ON password_reset_tokens(customer_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verification_customer ON email_verification_tokens(customer_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active_created ON newsletter_subscribers(active, created_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_created ON newsletter_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaign_recipients_campaign ON newsletter_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_hero_slides_active_order ON hero_slides(active, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_requests_status_created ON whatsapp_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_free_shipping_regions_active ON free_shipping_regions(active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_search_history_session ON search_history(session_id, searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_popular ON search_history(results_count, searched_at DESC);

INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
