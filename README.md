# RIDEKIT Helmet Store

Responsive helmet e-commerce with Pix checkout (Asaas), admin panel and SQLite storage.

## Stack

- Next.js App Router + TypeScript, Tailwind CSS
- Node.js Route Handlers, SQLite through the built-in `node:sqlite` module
- Zod request validation
- Asaas (Pix), Resend (e-mail), ViaCEP/BrasilAPI (CEP)

## Run locally

Requires Node 24 (see `.nvmrc`) and pnpm (`corepack enable` installs the version pinned in `package.json`).

```bash
cp .env.example .env.local   # then fill in the secrets
pnpm install
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`. The route inventory is at `/mapa` (development only); API documentation is in [API.md](./API.md).

Demo accounts after `db:seed`: customer `carlos-silva@example.com` / `Ridekit123!`, admin `admin@ridekit.com.br` / `Admin123!` at `/admin/login`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm lint` | TypeScript + ESLint |
| `pnpm test:unit` | Unit and integration tests on an in-memory database (orders, stock, coupons, security) |
| `pnpm test` | Smoke test against a running server (`SMOKE_URL`, defaults to `APP_URL`) |
| `pnpm test:e2e` | Playwright (desktop + mobile); set `PLAYWRIGHT_BASE_URL` to test an already running `pnpm start`, otherwise it starts `pnpm dev` |
| `pnpm test:a11y` | Only the axe accessibility checks (fails on serious and critical issues, including contrast) |
| `pnpm test:lighthouse` | Lighthouse on the production build (`pnpm build` first; Chrome from Playwright or `CHROME_PATH`) |
| `pnpm db:seed` | Reset the database with demo data (refuses `NODE_ENV=production`) |
| `pnpm backup` | Consistent snapshot of the database (`VACUUM INTO`) and `public/uploads` into `backups/` |
| `pnpm retention:preview` / `pnpm retention:apply` | Data retention routine, see [docs/retention.md](./docs/retention.md) |

The e2e order-flow test also needs `ASAAS_WEBHOOK_TOKEN` set to the same value as the server. Start the server under test with `E2E_RATE_LIMIT_SCALE=20` when running the suite repeatedly: it reuses the seeded accounts, and the per-account login limits would otherwise kick in (never set it in production). CI does both.

## Environment

See [.env.example](./.env.example).

| Variable | Required in production | Notes |
|---|---|---|
| `JWT_SECRET`, `ADMIN_JWT_SECRET`, `NEWSLETTER_SECRET` | yes | Long random values, all different. The app refuses to sign tokens without them. |
| `APP_URL` | yes | Base for links sent by e-mail; never derived from the request's Host header in production. |
| `DATABASE_PATH` | no | Defaults to `data/ridekit.sqlite`. |
| `ASAAS_API_URL`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` | for Pix | Sandbox URL by default. The webhook rejects every call while the token is empty. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_EMAIL` | for e-mail | Without a key, e-mails are stored as previews in `email_outbox`. |
| `TRUSTED_PROXY` | behind a proxy | `1` only when a reverse proxy overwrites `X-Forwarded-For`/`X-Real-IP`; otherwise the header is not trusted for rate limiting. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no | Development bootstrap admin when the table is empty (never in production). |

## How orders work

Checkout reserves stock in one transaction. Every later change (payment webhook, admin, reconciliation, the 5-minute expiry job in `instrumentation.ts`) goes through `lib/order-state.ts`, which owns stock, reservations and coupon usage. Details and the allowed transitions are in [API.md](./API.md#order-lifecycle).

## Operations notes

- Rate limits and the reservation scheduler live in process memory: run a single instance, or move them to a shared store before scaling out.
- Uploaded images are written to `public/uploads` (not versioned); include that folder in backups, or move uploads to object storage if the host has an ephemeral disk.
- The Content-Security-Policy ships in report-only mode; review violations, then switch it to `Content-Security-Policy` in `next.config.ts`.
- Schema changes are applied at startup by `initializeDatabase` in `lib/db.ts`, shared by the app, scripts and tests. New changes go in a numbered file `data/migrations/NNN-description.sql` (next free number, starting at 002); each runs once in a transaction and is recorded in `schema_migrations`.
