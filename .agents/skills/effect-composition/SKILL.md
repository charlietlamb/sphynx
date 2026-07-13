---
name: effect-composition
description: Use when writing or reviewing Effect TypeScript code and deciding between Effect.gen/yield* and pipe-based composition. Applies to service business logic, dependency access, branching, sequential operations, error handling, tracing, layer building, and simple transforms.
---

# Effect Composition

Use both `Effect.gen` and `.pipe`; choose by intent.

## Rule

- Use `Effect.gen` with `yield*` for business logic.
- Use `.pipe` for composition, cross-cutting concerns, and simple transforms.

## Decision Matrix

Use `Effect.gen` for:

- injecting or retrieving dependencies
- conditional logic
- sequential operations
- multi-step workflows
- code that would become a wall of `map`, `flatMap`, or `andThen`

Use `.pipe` for:

- error handling
- adding tracing, spans, annotations, retries, and timeouts
- layer building
- composing services, handlers, or middleware
- simple transforms
- shaping an already-defined effect from the outside
- structured log annotations

## Pattern

Keep business logic inside the generator and apply cross-cutting concerns outside.

```ts
const createCredential = (input: CreateCredentialInput) =>
  Effect.gen(function* () {
    const repo = yield* CredentialRepository;
    const clock = yield* Clock.Clock;

    if (!input.allowedHosts.length) {
      return yield* Effect.fail(new EmptyAllowedHostsError());
    }

    const now = yield* clock.currentTimeMillis;

    return yield* repo.insert({
      ...input,
      createdAt: new Date(now),
    });
  }).pipe(
    Effect.withSpan("CredentialService.create"),
    Effect.retry(Schedule.exponential("100 millis").pipe(Schedule.compose(Schedule.recurs(2)))),
  );
```

## Spans And Logs

Every exported service method should have one clear span. Use stable names:

- `CredentialService.create`
- `AgentSessionService.create`
- `BrokerService.fetch`
- `AuditService.record`

Add log annotations outside the business block with `.pipe(...)`. Include identifiers that help debug production incidents:

- `orgId`
- `credentialHandle`
- `credentialId`
- `sessionId`
- `agentId`
- `runId`
- `method`
- `host`
- `path`
- `decision`
- `statusCode`
- `latencyMs`

Never log raw secrets, access tokens, refresh tokens, API keys, bearer headers, session tokens, or encrypted secret payloads.

Use logs for lifecycle events where they matter:

- credential created
- agent session created
- broker request allowed
- broker request denied
- audit event written

Keep log messages short and let annotations carry the detail.

## Avoid

Avoid turning business logic into long chains:

```ts
// Avoid for branching business logic.
repo.find(id).pipe(
  Effect.flatMap((credential) =>
    credential.revoked
      ? Effect.fail(new CredentialRevokedError())
      : repo.touch(credential.id)
  ),
);
```

Prefer:

```ts
const touchCredential = (id: string) =>
  Effect.gen(function* () {
    const repo = yield* CredentialRepository;
    const credential = yield* repo.find(id);

    if (credential.revoked) {
      return yield* Effect.fail(new CredentialRevokedError());
    }

    return yield* repo.touch(credential.id);
  });
```
