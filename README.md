# RIDEKIT Helmet Store

Responsive e-commerce implementation based on the supplied Figma design system.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Node.js Route Handlers
- SQLite through the built-in `node:sqlite` module
- Zod request validation
- Unsplash-hosted catalog imagery with attribution metadata

## Run locally

Requires Node 24 (see `.nvmrc`) and pnpm (`corepack enable` installs the version pinned in `package.json`).

```bash
pnpm install
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`. The visual route inventory is at `/mapa`; API documentation is in [API.md](./API.md).

## Commands

- `pnpm dev` — development server
- `pnpm build` — production build
- `pnpm lint` — TypeScript + ESLint
- `pnpm test:unit` — unit/integration tests (in-memory SQLite)
- `pnpm test` — smoke tests against a running server
- `pnpm db:seed` — create/reset the populated SQLite database (refuses to run with `NODE_ENV=production`)
- `pnpm backup` — consistent snapshot of the database (`VACUUM INTO`) and `public/uploads` into `backups/`
- `pnpm retention:preview` / `pnpm retention:apply` — see [docs/retention.md](./docs/retention.md)

## Optional integrations

- **CEP:** ViaCEP, with BrasilAPI fallback, is used through `/api/cep/:cep`; neither service requires an API key.
- **Frete regional:** the admin can create free-shipping rules by CEP prefix, district, city and state, including scheduled promotions and standard/express delivery scope.
- **Email:** create a free Resend account, verify a sender and set `RESEND_API_KEY`, `EMAIL_FROM` and `CONTACT_EMAIL` in `.env.local`.
- **Cadastro por e-mail:** novas contas recebem um link de validação com validade de 24 horas e só podem entrar depois da confirmação. Ao validar, o sistema envia automaticamente o e-mail de boas-vindas.
- **Boas-vindas configuráveis:** assunto, HTML e pré-visualização ficam em `/admin/configuracoes`; os campos aceitam `{{name}}`, `{{store_name}}` e `{{home_url}}`.
- Without a Resend key, emails are recorded as previews in the local `email_outbox` table so every flow remains testable.

Copy `.env.example` to `.env.local` and replace all development secrets before exposing the app outside a trusted test network. The customer and admin login endpoints include in-memory rate limiting. For multiple production instances this limiter should be replaced by a shared Redis-compatible store.
# ridkit
