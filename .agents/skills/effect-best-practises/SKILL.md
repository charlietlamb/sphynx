---
name: effect-best-practises
description: Use when writing or reviewing Effect TypeScript code, especially choices between Effect.gen, yield*, pipe, layers, transforms, error handling, tracing, and readable service orchestration.
---

# Effect Best Practises

Use this skill to keep Effect code readable to engineers who are still learning Effect. Prefer the simplest syntax for the shape of the work.

## Decision Rules

- Use `Effect.gen` with `yield*` for business logic.
- Use `Effect.gen` when the code retrieves services, branches, loops, or performs multiple dependent steps.
- Use `.pipe` for composition, simple transforms, error handling, tracing, retry policy, logging annotations, and layer wiring.
- Do not turn sequential business flows into long chains of `map`, `flatMap`, `andThen`, and `tap`.
- Do not wrap a one-line transform in `Effect.gen`.
- Keep cross-cutting concerns outside the business block with `.pipe(...)`.

## Preferred Shape

Put the domain flow inside `Effect.gen`, then compose around it:

```ts
const program = Effect.gen(function* () {
  const service = yield* Service;
  const input = yield* loadInput;

  if (!input.enabled) {
    return yield* Effect.fail(new DisabledError());
  }

  return yield* service.run(input);
}).pipe(
  Effect.withSpan("service.run"),
  Effect.retry(retryPolicy),
  Effect.provide(ServiceLive)
);
```

For simple transforms, stay in `.pipe`:

```ts
const names = users.pipe(
  Effect.map((users) => users.map((user) => user.name)),
  Effect.map((names) => names.sort())
);
```

## Layer Style

- Build services with `Context.Tag` and concrete `Layer` values.
- Keep layer composition declarative with `.pipe(Layer.provide(...))` or `Layer.mergeAll(...)`.
- Use `Effect.scoped` for long-lived servers, clients, pools, and subscriptions.
- Keep handlers thin; domain behavior belongs in services.

## Review Checklist

- Can a new engineer read the happy path top-to-bottom?
- Is business branching inside `Effect.gen` rather than hidden in nested callbacks?
- Are tracing, retries, catches, and dependency provisioning outside the core flow?
- Did simple transforms avoid unnecessary generators?
- Are resources acquired and released through Effect scopes?
