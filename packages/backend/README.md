# @sphynx/backend

Convex backend for Sphynx. Holds the read model, webhook ingest, materializer,
reconcile cron, auth (Better Auth Local Install), and writes — the whole server,
replacing the deleted Neon + Effect/Bun stack.

## Node requirement

Convex `"use node"` actions (RS256 signing, HMAC verify, GitHub fetches) need a
supported system Node (18/20/22/24). This machine's default `node` is v26, which
the local backend rejects. Use nvm's Node 22 for every Convex command:

```bash
nvm use            # reads .nvmrc -> 22
bunx convex dev    # or: convex run / convex env ...
```

## Layout

- `convex/schema.ts` — the read-model tables.
- `convex/github/` — materializer, projector, writer, decision/mapper ports.
- `convex/http.ts` — webhook receiver + Better Auth routes.
- `convex/crons.ts` — reconcile.
- `convex/betterAuth/` — Better Auth Local Install (self-owned auth schema).
- `convex/spikes/` — Stage-A proof-of-concept probes (Effect-in-Convex, App JWT).

## Conventions

All functions follow `@convex-dev/eslint-plugin` (object syntax, `args`+`returns`
validators, `withIndex` not `.filter()`, `internal.*` for scheduled targets, Node
APIs only in `"use node"` files). Domain logic runs as Effect programs inside
handler bodies via `Effect.runPromise(program.pipe(Effect.provide(...)))`.
