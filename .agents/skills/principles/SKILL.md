---
name: principles
description: Use when reviewing or designing code against engineering principles such as Open/Closed, single responsibility, dependency inversion, cohesion, coupling, and pragmatic extensibility. Prefer concise, codebase-specific guidance over generic theory.
---

# Principles

Use this skill when the user asks whether code follows a design principle or
asks to improve a design around extensibility, coupling, boundaries, or
maintainability.

## Open/Closed Principle

Code should be open for extension and closed for modification.

In this repo, that means:

- Add new behavior by adding focused modules behind an existing interface.
- Keep orchestration services stable when adding a new concrete implementation.
- Allow composition roots to change when wiring new implementations into the
  runtime.
- Do not add generic frameworks before the second or third concrete use case
  proves the abstraction.

For Botcoin strategies:

- `EngineStrategy` is the extension interface.
- `EngineLive` should not change when a new strategy is added.
- New strategy logic should live in a focused file under
  `apps/server/src/market/engine/strategies/`.
- `apps/server/src/market/engine/strategies/index.ts` is allowed to change as
  the composition point that chooses which strategies are live.
- Strategies should emit alpha events only; they should not create signals,
  trade packages, hedged packages, risk decisions, order
  intents, mutate execution state, or inspect raw upstream payloads.

For Botcoin execution and positions:

- Dry/sim execution owns order lifecycle facts from CLOB or simulated CLOB.
- Position tracking is a hot read model over execution facts; it should not talk
  to CLOB, inspect order intents, or expire orders from raw market data.
- Keep sell handling reduce-only until short selling is explicitly designed. Do
  not introduce negative inventory, margin, borrow, or short exposure as a
  hidden extension point.

For Botcoin ops read models:

- Add visibility by adding a focused read model behind a small service, not by
  teaching execution, risk, or strategy services about UI concerns.
- Read models may group and summarize events for operators, but they must not
  become sources of trading truth or feed back into order creation.

## Review Checklist

Before claiming a design follows Open/Closed, check:

- Can a new variant be added without editing the central orchestration flow?
- Is the extension interface small and domain-specific?
- Is the only required edit a composition/registration point?
- Are tests able to inject a new implementation without touching production
  services?
- Is the abstraction justified by current or near-term variants, not invented
  for speculative flexibility?

If the answer is no, prefer a small refactor over adding another abstraction.
