---
name: effect
description: Use when adding or refactoring Effect services, layers, streams, schemas, config, HTTP APIs, database access, or tests in this repo. Requires consulting the local Effect submodule and deriving TypeScript types from Effect Schema definitions.
---

# Effect

Use this skill for Effect-based backend work in this repo.

## Source Of Truth

- Prefer local examples and source from `context/effect`.
- For official docs, use `https://effect.website/docs/`.
- Before inventing a pattern, search `context/effect` and existing `apps/server` / `packages/*` code.
- For `Effect.gen` vs `.pipe` style decisions, also use the `effect-composition` skill.

## Repo Rules

- Use Effect services via `Context.Tag`.
- Provide concrete implementations with `Layer`.
- Use `Effect.scoped` for long-lived runtimes and owned resources.
- Use `Config` for environment variables.
- Use `Clock` for all current-time/time-of-run logic inside Effect code. Avoid
  `Date.now()`; get `Clock.currentTimeMillis` or another `Clock` effect and
  derive timestamps from that value. Constructing `Date` from an existing
  timestamp/string for parsing or formatting is fine.
- Use Effect retry/schedule/stream primitives instead of ad hoc loops where practical.
- Add one clear `Effect.withSpan` to every exported service method and use
  `Effect.annotateLogs` for non-secret identifiers. Never log raw secrets,
  tokens, bearer headers, session tokens, or encrypted secret payloads.
- Keep repository and integration boundaries behind narrow services.
- For hot ops read models, consume typed event-family streams into a scoped
  service-owned `Ref`, expose narrow read methods, and keep the read model
  separate from decision-making services.
- For package flow services, consume the typed upstream family stream and publish
  only the next family: `alpha` to `signal`, `signal` to `trade`,
  `TradePackageCreated` to `risk`, and accepted/adjusted `risk` packages to
  individual `intent` events. `NoTradePackage` is terminal and should not be
  forwarded to risk or intent.
- For hot position tracking, consume only execution facts emitted by dry/sim
  execution. Prefer a schema-backed execution event substream, decode with
  Effect Schema before updating `Ref` state, and keep the position reducer
  pure/testable.
- Do not make position tracking talk to CLOB, derive state from order intents, or
  independently expire orders from market data. Execution owns
  `ExecutionOrderExpired`.
- Short selling is not modeled in v1; avoid negative inventory, margin, borrow,
  and short-exposure assumptions.

## Schema Rules

- Use `effect/Schema` for backend boundaries and shared contracts.
- Define the schema first, then derive TypeScript types from it.
- Do not duplicate hand-written interfaces for data that is already represented by a schema.

```ts
import { Schema } from "effect";

export const MarketSchema = Schema.Struct({
  marketId: Schema.String,
  active: Schema.Boolean,
});

export type Market = typeof MarketSchema.Type;
export type MarketEncoded = typeof MarketSchema.Encoded;
```

## API Rules

- Prefer Effect HTTP API contracts in `packages/schema`.
- Keep API response schemas in shared packages so server and clients consume the same contract.
- Keep handler code thin; domain behavior belongs in services.

## Validation

Run the relevant workspace checks after changes:

```bash
bun run check
bun run typecheck
bun run test
```
