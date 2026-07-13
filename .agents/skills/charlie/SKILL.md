---
name: charlie
description: Strict Charlie frontend standards for React and TypeScript work. Use when building, reviewing, or refactoring frontend components, hooks, forms, state management, TanStack Query usage, or shared UI logic.
---

# Charlie

## Strict Defaults

- Barely use `useEffect`. If the logic is derived state, event handling, form state, querying, mutation handling, or synchronization that can live elsewhere, remove the effect.
- Clean up existing code when you can do it safely. Remove dead branches, duplicated state, unnecessary wrappers, stale helpers, and unused props.
- Always use TanStack Form for forms. Do not build ad hoc form state with scattered `useState` calls.
- Use TanStack Query for server state, querying, caching, mutations, invalidation, and loading/error states.
- Avoid many `useState` calls in a component. Group related state, derive values during render, move complex state to TanStack Form or TanStack Query, or extract a custom hook.
- Use one component per file. Extract child components into their own files when they become meaningful units.
- Keep code concise. Prefer clear names, short functions, direct returns, and small components.
- Never repeat yourself. Extract shared logic into typed helpers, hooks, or components when the behavior is the same.
- Put complex component logic in a custom hook with typed inputs and outputs.
- Only use `useMemo` when it is clearly needed for expensive computation or referential stability. Do not memoize simple expressions by default.
- Use shadcn/ui primitives before custom UI markup.
- Use the `cn` util for className concatenation and conditional classes.

## Hard No

- No nested ternaries.
- No effects for derived state.
- No local form engines when TanStack Form fits.
- No client-side fetching with raw `useEffect`.
- No repeated copy-paste blocks.
- No large components that mix layout, querying, form handling, and business logic.
- No manual className string concatenation when `cn` is available.

## Referenced Skills

Apply these alongside this skill when relevant:

- `frontend` for the baseline frontend standards.
- `shadcn` for component composition and styling.
- `tanstack-query-best-practices` for server state and mutation patterns.
- `vercel-react-best-practices` for React and Next.js performance.
