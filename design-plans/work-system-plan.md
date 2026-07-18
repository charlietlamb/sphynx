# Work-system plan — from "one shitty list" to a system

The original statement: "PRs should be treated as linear bits of work that go into a branch — right now in GitHub it's just one shitty list of PRs — but really different PRs relate to each other, have varying effects on the codebase, different priorities, different review statuses. We need a system which reflects this change."

That names five problems. Each gets a concrete fix inside the approved shell (header card + flow rail / queue / dossier). Layout is settled; this plan is about making the data model visible.

## Problem 1 — PRs are linear work flowing into a branch, GitHub shows a flat list

**Fix: the branch is the container everywhere.**
- Flow rail renders the repo's real topology: stages (`dev` → `main`) as filled nodes with the promotion gap between them ("7 commits waiting · promotion #212" / "in sync"), feature bases (`john/migration/*`, `containers/agent`) as hollow nodes. Data: pipeline endpoint (built, tested).
- Queue groups rows by target branch when a repo has multiple bases; selecting a branch in the rail (`1–9`) filters the queue. autumn's 8 PRs that target `main` directly stop hiding among the 20 targeting `dev`.
- "Shipped, not on main" is a real queue section — merged-to-dev work sitting in the gap, sourced from `gap.pulls`. Done reviewing ≠ done shipping, and the list finally says so.

## Problem 2 — PRs relate to each other

**Fix: three relations, each first-class.**
- **Stacks** (derivable now: PR whose base = another open PR's head): child renders nested under its parent in the queue with a spine and "holds #N" — it can never be sorted away from its parent. Order of merge is visible.
- **Collisions** (needs backend addition): add `files(first: 100) { nodes { path } }` to the open-pulls GraphQL query. Two open PRs sharing paths get a subtle link glyph on both rows; the dossier lists "overlaps #2245 (3 files)". This is the honest version of "these PRs affect each other" — merge order suddenly matters and nobody currently sees it.
- **Author trains**: focusing a PR faintly marks the author's other rows; no dedicated layout, just recognition (avatars already carry it).

## Problem 3 — PRs have varying effects on the codebase

**Fix: mass and blast radius, shown discretely (no fake precision).**
- Size class chip per row (XS/S/M/L/XL from additions+deletions, stepped) instead of raw numbers in the list; raw `+412 −88 · 14 files` lives in the dossier.
- With file paths from problem 2: **areas touched** — top-level dirs as chips ("server, schema, web") in the dossier; a migration/lockfile/CI-config touch gets a "sensitive paths" marker.
- High-risk definition already exists (`isHighRisk`: >800 additions or >30 files) and feeds the blocker line ("high risk, one reviewer").

## Problem 4 — PRs have different priorities

**Fix: priority is computed, not implied by recency.**
- Queue sections are the priority function, by what the reviewer should do: **needs decision** (contested + ready — signal is in, a human verdict is cheap), **waiting on reviews** (deciding now is premature — kept visible but calm), **shipped not on main**, **drafts** (collapsed).
- Within a section: attention score = state rank, then staleness × mass — old decidable work rises instead of rotting. An approved-green PR untouched for 15 days outranks one approved an hour ago.
- The one-line claim ("approved 2×, green, 15d old — why is this still open?") is each row's justification for its position — priority explains itself.

## Problem 5 — PRs have different review statuses

**Fix: the aggregated verdict is the product.**
- Row level: reviewer avatars with verdict-colored rings (green approved / red changes / gray commented) + parsed score where present — bot and human votes side by side at a glance.
- Dossier: the verdict matrix as the biggest element — reviewer, kind (bot/human), verdict, score, age of verdict — plus consensus/contention read ("claude 8/10 and greptile approve; cursor wants changes — split verdict").
- CI, unresolved threads, and the computed decision (`ready`/`contested`/`needs-eyes`) stay the row's truth signals; merge/block actions live in the dossier next to the evidence.

## Build order

1. **Phase 2 — queue pane** (problems 4 + 5 row-level + branch grouping from 1): sections, attention ordering, avatar rows, verdict chips, size class, claims. Data: existing dev endpoints.
2. **Phase 3 — dossier** (problem 5 deep + 3): verdict matrix, claim headline, raw stats, actions (merge/block wired, untested against live PRs per safety rule).
3. **Phase 4 — flow rail** (problem 1): branch spine, gap/promotion state, branch filtering, "shipped not on main" section wiring.
4. **Phase 5 — relations backend + UI** (problem 2 + rest of 3): file paths in the GraphQL query → collisions, areas touched, sensitive paths; stack nesting in the queue.
5. **Phase 6 — keyboard + polish**: j/k, enter, 1–9, [ ], focus discipline, empty/error states, light theme pass.

Screenshot gate at 1440×900 after each phase; check in with the user each time.
