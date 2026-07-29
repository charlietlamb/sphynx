# Sphynx

Code review platform built with TanStack Start, Convex, and Better Auth.

## Setup

```sh
bun install
cp .env.example .env
nvm use
bun dev
```

The web app runs on port `3006`. Convex owns persistence, auth, webhooks,
background reconciliation, and the GitHub read model.

## Foundation

- TanStack Start and React
- Convex
- Bun and Effect Schema
- Better Auth with GitHub
- Shared UI package
