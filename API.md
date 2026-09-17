# RIDEKIT API

Local base URL: `http://localhost:3000/api`

The API uses Next.js Route Handlers on the Node.js runtime and the built-in `node:sqlite` driver. All responses use `{ "data": ... }`; errors use `{ "error": "..." }` and the appropriate HTTP status.

## Setup

```bash
npm install
npm run db:seed
npm run dev
```

The seed is deterministic and can be run again to reset demonstration data.

## Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Runtime, database and record health |
| GET | `/api/cep/:cep` | Address lookup through ViaCEP with BrasilAPI fallback |
| GET | `/api/shipping/quote` | Quote shipping by CEP, subtotal and delivery method |
| GET, POST, PATCH, DELETE | `/api/shipping-regions` | Admin management of regional free-shipping rules |
| POST | `/api/contact` | Store a support message and notify the team |
| POST | `/api/newsletter` | Subscribe an email and send confirmation |
| POST | `/api/auth/register` | Create an unverified customer and send the 24-hour validation link |
| GET | `/api/auth/verify-email?token=...` | Validate the address, activate the account and send the configurable welcome email |
| POST | `/api/auth/resend-verification` | Resend a validation link without revealing whether the account exists |
| POST | `/api/auth/forgot-password` | Request a password-reset email |
| POST | `/api/auth/reset-password` | Consume a reset token and set a new password |
| PATCH, DELETE | `/api/account/addresses/:id` | Manage an authenticated customer's address |
| GET | `/api/catalog` | Brands, categories and featured products |
| GET, POST | `/api/products` | Filtered catalog and product creation |
| GET, PATCH, DELETE | `/api/products/:id-or-slug` | Product detail, edit and soft delete |
| GET, POST, PATCH, DELETE | `/api/cart` | Persistent cart by `session_id` |
| GET, POST | `/api/orders` | Order list and transactional checkout |
| POST | `/api/whatsapp-checkout` | Build a WhatsApp order from the authenticated customer's saved profile and primary address |
| GET, PATCH | `/api/orders/:id` | Order detail, tracking and status updates |
| GET | `/api/dashboard` | Revenue, stock, order and product metrics |
| CRUD | `/api/brands/:id` | Brand management |
| CRUD | `/api/categories/:id` | Category management |
| CRUD | `/api/customers/:id` | Customer management |
| CRUD | `/api/coupons/:id` | Coupon management |
| CRUD | `/api/reviews/:id` | Review moderation |
| CRUD | `/api/variants/:id` | Variant and inventory management |

## Product filters

`GET /api/products?q=ls2&brand=ls2&category=fechados&min_price=500&max_price=1500&featured=1&sort=rating&page=1&limit=12`

Supported sorting: `price_asc`, `price_desc`, `rating`, `newest`.

## Add to cart

```json
POST /api/cart
{
  "session_id": "browser-session-001",
  "customer_id": 1,
  "variant_id": 1,
  "quantity": 1
}
```

Read the cart with `GET /api/cart?session_id=browser-session-001`. Update an item using `PATCH` with `session_id`, `item_id` and `quantity`; remove it with `DELETE` and `session_id` plus `item_id`.

## Create an order

```json
POST /api/orders
{
  "coupon_code": "PIX5",
  "payment_method": "pix",
  "shipping_method": "Econômica",
  "shipping_address": {
    "zip_code": "01100-000",
    "street": "Rua das Pilotas",
    "number": "123",
    "district": "Centro",
    "city": "São Paulo",
    "state": "SP"
  },
  "items": [{ "variant_id": 1, "quantity": 1 }]
}
```

Order creation validates stock, coupon availability and customer data within one SQLite transaction. Stock is reserved at creation, committed after payment and restored on cancellation/refund.

The customer is always resolved from the authenticated HttpOnly session cookie. A `customer_id` supplied by the browser is ignored/rejected by validation.

## Regional free shipping

Administrators configure rules at `/admin/frete-regional`. A rule may combine CEP prefix, district, city and state, with optional start/end dates. `applies_to` accepts `standard` or `all`; all populated geographic fields must match the resolved CEP.

Example quote: `GET /api/shipping/quote?cep=72600100&subtotal=89990&method=standard`. The response includes the resolved address, freight price, reason and matched rule. Order and WhatsApp checkout store a snapshot of the rule that granted free shipping.

## Customer email validation

Registration does not create a logged-in session. A single-use token is stored only as a SHA-256 hash, expires after 24 hours and activates the customer through `/api/auth/verify-email`. Login rejects pending accounts. After activation, the welcome template configured at `/admin/configuracoes` is sent through Resend; the supported placeholders are `{{name}}`, `{{store_name}}` and `{{home_url}}`.

## Notes

- This is a local development API. Authentication and payment provider credentials are intentionally not simulated as production secrets.
- Prices are stored as integer cents.
- Product removal is a soft delete to preserve order history.
- Unsplash URLs and attribution metadata are stored in `product_images`.
