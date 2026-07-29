# @sphynx/backend

Convex backend for Sphynx. Holds the GitHub read model, webhook ingest,
materializer, reconciliation, Better Auth, and writes.

## Node requirement

Use the repository's Node 22 version for Convex CLI commands and Node actions:

```bash
nvm use
bunx convex dev    # or: convex run / convex env ...
```

## Layout

- `convex/schema.ts` — the read-model tables.
- `convex/github/` — materializer, projector, writer, decision/mapper ports.
- `convex/http.ts` — webhook receiver + Better Auth routes.
- `convex/crons.ts` — reconcile.
- `convex/betterAuth/` — Better Auth Local Install (self-owned auth schema).

## Conventions

All functions follow `@convex-dev/eslint-plugin` (object syntax, `args`+`returns`
validators, `withIndex` not `.filter()`, `internal.*` for scheduled targets, Node
APIs only in `"use node"` files). GitHub payloads are decoded with Effect Schema
at the boundary.
