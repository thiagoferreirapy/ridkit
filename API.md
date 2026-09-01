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
| GET | `/api/catalog` | Brands, categories and featured products |
| GET, POST | `/api/products` | Filtered catalog and product creation |
| GET, PATCH, DELETE | `/api/products/:id-or-slug` | Product detail, edit and soft delete |
| GET, POST, PATCH, DELETE | `/api/cart` | Persistent cart by `session_id` |
| GET, POST | `/api/orders` | Order list and transactional checkout |
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
  "customer_id": 1,
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

## Notes

- This is a local development API. Authentication and payment provider credentials are intentionally not simulated as production secrets.
- Prices are stored as integer cents.
- Product removal is a soft delete to preserve order history.
- Unsplash URLs and attribution metadata are stored in `product_images`.
