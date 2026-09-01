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

```bash
npm install
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The visual route inventory is at `/mapa`; API documentation is in [API.md](./API.md).

## Commands

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — TypeScript validation
- `npm run db:seed` — create/reset the populated SQLite database
