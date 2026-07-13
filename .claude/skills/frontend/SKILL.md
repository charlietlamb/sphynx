---
name: frontend
description: Frontend engineering standards for React and TypeScript work. Use when building, reviewing, or refactoring frontend UI, forms, state, data fetching, hooks, or shared component logic.
---

# Frontend

## Default Approach

- Stay away from `useEffect`. Use it only to synchronize with external systems, and never for derived state, event handling, data fetching that belongs in TanStack Query, or logic that can run during render.
- Do not repeat yourself. Extract shared logic into typed helpers, shared components, or custom hooks when the duplication reflects the same product behavior.
- Keep components focused on rendering and composition. Move complex state, branching, and orchestration into custom hooks with clear inputs and return types.
- Prefer clean shared logic over one-off component-local code. Keep abstractions small, named after the domain behavior, and easy to test.
- Only use `useMemo` when it is clearly needed for expensive computation or referential stability. Do not wrap simple expressions or props by default.
- Use TanStack Form for forms, including validation, field state, submission state, and form-level orchestration.
- Use TanStack Query for querying, caching, mutations, invalidation, prefetching, and server-state lifecycle management.
- Use shadcn/ui components before creating custom UI primitives, and compose them with semantic tokens and accessible structure.
- Use the `cn` util for className concatenation and conditional classes.

## Referenced Skills

When the task touches these areas, also apply the relevant project skill:

- `shadcn` for shadcn/ui components, styling, component composition, and accessibility conventions.
- `vercel-react-best-practices` for React and Next.js performance, rendering, data-fetching, and bundle guidance.
- `tanstack-query-best-practices` for query keys, caching, mutations, invalidation, prefetching, SSR, and server state.
- `baseline-ui` for the non-negotiable UI baseline — animation, accessibility, typography, layout, and performance constraints when building or reviewing components.
- `react-doctor` after finishing a feature or before committing — run `/doctor` to scan for security, performance, correctness, and architecture issues and check the health score did not regress.
- `references` for research-based UI patterns and best practices.
- `design-engineer` for the design engineering orchestration skill.
- `charlie` for the strict Charlie frontend standards.

## Review Checklist

- Can this logic avoid `useEffect` by using render-time derivation, event handlers, TanStack Query, TanStack Form, or a custom hook?
- Is `useMemo` only used where it pays for itself?
- Is duplicated behavior extracted without creating a vague utility layer?
- Are forms powered by TanStack Form instead of local ad hoc form state?
- Is remote data modeled as server state with TanStack Query?
- Are shadcn/ui primitives used and composed before custom markup?
- Are className values composed with `cn` instead of manual string concatenation?
