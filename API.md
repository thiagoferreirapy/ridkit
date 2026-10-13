# RIDEKIT API

Local base URL: `http://localhost:3000/api`

Next.js Route Handlers on the Node.js runtime with the built-in `node:sqlite` driver. Responses use `{ "data": ... }`; errors use `{ "error": "..." }` with the matching HTTP status (`400` bad request, `401` no session, `403` not allowed, `404`, `409` conflict, `422` validation, `429` rate limited).

Customers authenticate with HttpOnly cookies (`/api/auth/*`); the admin panel uses separate cookies (`/api/admin-auth/*`). Any `customer_id` sent by the browser is ignored: the customer always comes from the session.

## Setup

```bash
pnpm install
pnpm db:seed
pnpm dev
```

`db:seed` resets the database with demo data (refuses to run with `NODE_ENV=production`). Demo logins: customers `carlos-silva@example.com` … with `Ridekit123!`, admin `admin@ridekit.com.br` / `Admin123!`.

## Public storefront

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check (no internal details) |
| GET | `/api/catalog` | Brands, categories, sizes and filter metadata |
| GET | `/api/products` | Published products with filters and pagination (no purchase cost) |
| GET | `/api/products/:id-or-slug` | Published product detail, variants, attributes, size chart, reviews |
| GET, POST, DELETE | `/api/search` | Suggestions, recent searches per `session_id`, popular searches |
| GET | `/api/hero-slides` | Active home banners |
| GET | `/api/store-settings` | Public store settings (purchase mode, shipping, Pix discount) |
| GET | `/api/cep/:cep` | Address lookup (ViaCEP with BrasilAPI fallback) |
| GET | `/api/shipping/quote` | Shipping quote by CEP, subtotal and method |
| GET, POST, PATCH, DELETE | `/api/cart` | Cart by `session_id`; a cart linked to an account is only visible to it |
| POST, DELETE | `/api/cart/coupon` | Redeem/select or clear a coupon (requires login) |
| GET, POST, DELETE | `/api/favorites` | Favorites by `session_id` |
| GET, POST | `/api/reviews` | Approved reviews; customers with a paid order can review |
| POST | `/api/review-images` | Upload review photos |
| POST | `/api/contact` | Store a support message and notify the team |
| POST | `/api/newsletter`, GET `/api/newsletter/unsubscribe` | Subscribe; HMAC-signed unsubscribe link |
| POST | `/api/whatsapp-checkout` | Build a WhatsApp order from the logged-in customer's profile and address |

### Product filters

`GET /api/products?q=ls2&brand=ls2&category=fechados&size=58%20%2F%20M&min_price=500&max_price=1500&featured=1&offer=1&new=1&sort=best_selling&page=1&limit=12`

Sorting: `price_asc`, `price_desc`, `rating`, `newest`, `best_selling` (units sold in paid orders). `limit` is capped at 100. `?admin=1` returns drafts and cost and requires `catalog.view`.

## Customer account

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an unverified account and send a 24-hour validation link |
| GET | `/api/auth/verify-email?token=` | Activate the account and send the welcome email |
| POST | `/api/auth/resend-verification` | Resend the validation link (same answer whether or not the account exists) |
| POST | `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh` | Session; refresh tokens rotate and reuse revokes the family |
| GET | `/api/auth/me` | Current customer |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | Reset link valid for 30 minutes, single use; revokes all sessions |
| GET, PATCH, POST | `/api/account` | Profile, addresses, coupons and orders; changing the login e-mail requires `current_password` and confirmation from the new address |
| GET | `/api/account/confirm-email?token=` | Confirms an e-mail change and revokes every session |
| PATCH, DELETE | `/api/account/addresses/:id` | Manage a saved address |
| POST | `/api/account/close` | Close the account (password + confirmation phrase) |

Login, password reset, verification and coupon redemption are rate limited per IP **and** per account, so rotating `X-Forwarded-For` does not bypass them. The header is only trusted with `TRUSTED_PROXY=1`.

## Checkout and payment

### Create an order

```json
POST /api/orders
{
  "legal_version": "2026-09-21", "accept_terms": true, "acknowledge_privacy": true,
  "checkout_identity": { "email": "cliente@example.com", "cpf": "12345678909", "phone": "11987654321" },
  "idempotency_key": "7b0c4f0e-6a43-4c55-9d5e-0f6a4b7d2e11",
  "coupon_code": "PIX5",
  "payment_method": "pix",
  "shipping_method": "Econômica",
  "shipping_address": { "zip_code": "01100-000", "street": "Rua das Pilotas", "number": "123", "district": "Centro", "city": "São Paulo", "state": "SP" },
  "items": [{ "variant_id": 1, "quantity": 1 }]
}
```

- Prices, shipping, coupon and Pix discount are recomputed on the server; totals sent by the browser are ignored.
- Up to 20 lines; repeated `variant_id`s are merged and checked against stock as one quantity (max 10 per item).
- The CPF must pass check-digit validation.
- Stock is **reserved** inside the same `BEGIN IMMEDIATE` transaction. The reservation lasts 30 minutes until a Pix charge exists, then as long as the QR code is payable (`reservation_expires_at`).
- At most 3 unpaid orders per customer.
- **Idempotency:** retrying with the same key and the same content returns the existing pending order (`idempotent: true`). The same key with a different cart answers `409`. A key whose order is already closed is released for the new order.

### Pix

`POST /api/payments/pix { "order_id": 1 }` creates the Asaas charge (only for a pending order inside its reservation window; parallel calls cannot create two charges). `GET /api/payments/pix?order_id=1` returns the QR code and status.

### Order lifecycle

All status changes go through `lib/order-state.ts`, the only code that touches stock, reservations and coupon usage:

| Status | Units are |
|---|---|
| `pending` | reserved |
| `paid`, `preparing`, `shipped`, `delivered` | sold |
| `cancelled`, `refunded` | released (a refund after shipping does not restock automatically) |

Admin transitions (`PATCH /api/orders/:id { "status": "...", "tracking_code"?: "..." }`): `pending → paid | cancelled`, `paid → preparing | shipped | refunded`, `preparing → shipped | refunded`, `shipped → delivered | refunded`, `delivered → refunded`. Anything else answers `409`.

Orders that need a human decision (amount mismatch, payment received after the reservation expired with no stock left, stock inconsistency) keep the money recorded and get `attention_reason`; the admin order list highlights them.

### Asaas webhook

`POST /api/webhooks/asaas` with header `asaas-access-token: $ASAAS_WEBHOOK_TOKEN` (fails closed when the variable is missing).

- Events are deduplicated by `id` in the same transaction as their effects.
- `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` approve only when `payment.value` matches the order total.
- `PAYMENT_OVERDUE` / `PAYMENT_DELETED` cancel a pending order.
- `PAYMENT_REFUNDED` refunds it.
- Late or duplicate events never sell stock twice.

`POST /api/admin/reconcile-payment { "order_id": 1 }` queries Asaas and applies the same rules.

## Admin

Every admin route checks a permission (`lib/admin-permissions.ts`) and re-reads the admin's `active` flag on each request.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/admin-auth/login`, `/logout`, `/refresh`; GET `/me` | Admin session (TOTP 2FA and one-time recovery codes; each TOTP code is accepted once) |
| GET, POST, PUT, DELETE | `/api/admin/security` | Set up, confirm or disable 2FA (setup cannot replace an active secret) |
| GET, POST | `/api/admin/users` | Team members and permissions |
| GET | `/api/admin-logs` | Audit log |
| GET | `/api/dashboard` | Revenue and margin from paid orders, stock, operations |
| GET, POST | `/api/orders` | Paginated order list (`?status=`), checkout |
| GET, PATCH | `/api/orders/:id` | Order detail (customer) / status change (admin) |
| POST | `/api/admin/expire-reservations` | Run reservation expiry now (also runs every 5 minutes in-process) |
| POST | `/api/products`, PATCH/DELETE `/api/products/:id` | Catalog editing (`reserved_stock` is never written from the form) |
| CRUD | `/api/brands`, `/api/categories`, `/api/hero-slides`, `/api/category_size_chart` | Catalog resources |
| CRUD | `/api/variants`, `/api/inventory_movements` | Stock adjustments (logged as movements) |
| CRUD | `/api/customers` | Customers (no password field; changing the login e-mail needs `admins.manage`, unverifies it and revokes sessions) |
| CRUD | `/api/coupons` | Coupons with `per_customer_limit` and `first_order_only` |
| CRUD | `/api/reviews`, `/api/contact_messages`, `/api/newsletter_subscribers` | Moderation and support |
| GET, POST, PATCH, DELETE | `/api/shipping-regions` | Regional free-shipping rules |
| GET, POST | `/api/newsletter-campaigns` | Segmented campaigns (`{{home_url}}` is replaced in the HTML) |
| GET, PATCH | `/api/store-settings` | Store configuration |
| GET, PATCH | `/api/whatsapp-checkout` | WhatsApp sales requests |
| POST | `/api/uploads` | Image upload to `public/uploads` |

Generic CRUD routes accept `GET ?q=&page=&limit=`, `POST`, `GET/PATCH/DELETE /:id`; resources with `active` are soft-deleted.

## Dates

Times typed in the admin (`datetime-local`) and Asaas expirations are Brasília wall-clock times and are compared with `STORE_NOW_SQL` (`lib/store-time.ts`). Internal timestamps (tokens, reservations) are stored in UTC.

## Notes

- Prices are integer cents.
- Product removal is a soft delete to preserve order history.
- Without `RESEND_API_KEY`, e-mails are written to `email_outbox` as previews.
