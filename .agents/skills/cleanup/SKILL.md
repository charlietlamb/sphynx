---
name: cleanup
description: Use when cleaning up, shrinking, or refactoring this repo. Remove unneeded logic, keep code minimal, split oversized files, prefer Effect-native APIs, use Effect Schema at boundaries, and follow the clean service/module style used in sphen.
---

# Cleanup

Use this skill when a change should make the codebase smaller, simpler, and easier to read.

## Goal

Keep the implementation linear and boring:

- Delete dead code, unused branches, stale abstractions, and speculative extension points.
- Prefer fewer files only while each file stays focused; split large files by responsibility.
- Keep services short. Move parsing, normalization, persistence, and protocol helpers into `lib/`, `repos/`, `schemas/`, or domain-specific helper files when that makes the service read top-to-bottom.
- Use narrow `Context.Tag` services and concrete `Layer` implementations.
- Use `Effect`, `Stream`, `Schedule`, `Queue` / `PubSub`, `Ref`, and `Layer` instead of ad hoc async orchestration.
- Use `effect/Schema` for API, external input, DB-facing, websocket, and shared data boundaries; derive TypeScript types from schemas.
- Avoid hand-written duplicate types when a schema already exists.
- Do not keep compatibility code unless something still calls it.

## Sphen Pattern

When unsure, compare against `../sphen`:

- Contracts live in `packages/schema` and are shared by server/web.
- HTTP handlers stay thin and delegate to services.
- API route logic lives under `apps/server/src/api/handlers/`. Use one file per route when the route is distinct, or one domain file such as `markets.ts` when several endpoints share the same services and concept.
- Runtime wiring happens in `apps/server/src/app.ts` with named layers.
- Config is isolated in small `config.ts` files.
- Long-running jobs are small `program.ts` files that call services.
- Cross-cutting helpers live under `apps/server/src/lib`.
- Domain areas own their own `service.ts`, `program.ts`, `config.ts`, and focused helpers.

Do not copy sphen business logic. Copy its shape, naming discipline, and dependency boundaries.

## Refactor Rules

1. Start by finding what is actually used with `rg`.
2. Delete before abstracting.
3. Collapse wrappers that only rename another function.
4. Extract helpers only after they make the main flow shorter and clearer.
5. Prefer data-first pure functions for parsing and normalization.
6. Keep Effect services as orchestration, not dumping grounds for all helpers.
7. Keep API group registration files declarative; move endpoint bodies into `api/handlers/*`.
8. Keep files readable without scrolling through unrelated logic.
9. Validate with `bun run check`, `bun run typecheck`, and `bun run test`.

## Effect Schema Rules

- Define schemas at boundaries first.
- Export types as `typeof SomeSchema.Type`.
- Decode unknown external data immediately.
- Keep encoded/decoded distinctions explicit when relevant.
- Prefer shared schema package exports for API-visible types.

## Review Checklist

Before finishing, ask:

- Can any file, function, branch, or dependency be deleted?
- Can any helper be replaced with an Effect or platform API?
- Is business logic separated from transport/API handlers?
- Are API handlers in focused files under `api/handlers/`?
- Are schemas the source of truth for structured data?
- Does each file have one obvious reason to exist?
- Did the validation commands pass?
