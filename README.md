# Sphynx

Code review platform built as a Bun TypeScript monorepo.

## Setup

```sh
bun install
cp .env.example .env
bun run db:setup
bun dev
```

The web app runs on port `3006`, the Effect/Bun server on `3003`, and Postgres on `5433`.

## Foundation

- TanStack Start and React
- Bun and Effect
- Better Auth with GitHub and organizations
- Postgres and Drizzle ORM
- Shared UI package
