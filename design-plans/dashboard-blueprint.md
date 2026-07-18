# Dashboard blueprint — reset

## Why every attempt looked bad (diagnosis before design)

Four iterations (queue list, rails, flow, switchyard) failed the same way. The concepts were fine; the execution ignored the product's own design system.

1. **Built outside the app shell.** The landing and auth screens have an identity: Fraunces serif headings at real sizes, frame lines, mountain halftone texture, teal primary, generous `p-6 → p-12` breathing room, the Sphynx mark in a real header. Every dashboard was a bare `<div className="mx-auto max-w-*">` — no header, no frame, no surface layering. They read as debug output because structurally that's what they were.
2. **Type hierarchy abandoned.** Everything was 10–11px mono muted-foreground. Mono is for identifiers (`#2241`, `dev`, `+64 −12`) — when the whole page is mono microtext, nothing leads the eye and the page has no voice. Zero Fraunces anywhere.
3. **Width wasted.** `max-w-3xl`/`max-w-5xl` center columns on a 1440px viewport. The user asked for width; the data (a queue + a detail + a topology) genuinely needs it.
4. **Color too small to structure anything.** Signal lived in 3px ticks and 6px dots. The landing uses color as surface and presence; the dashboards used it as punctuation.
5. **Data-shape-first rendering.** Each screen rendered the API response (tracks, gaps, readiness scalars) instead of designing the screen a reviewer needs and binding data to it. Humans were never shown — we have `avatarUrl` for every author and reviewer and never rendered a single avatar.

## Binding rules for the rebuild

- Every authed screen renders inside the app shell: SiteHeader-derived chrome (mark, repo context, user menu), FrameLines, full-bleed width with `px-6 sm:px-9` gutters — never a centered narrow column.
- Type scale: Fraunces for the screen title and the focused PR title (`text-xl/2xl`), Geist 13–14px for body/rows, mono strictly for identifiers and numbers. Minimum text size 11px, used sparingly.
- Faces first: author and reviewer avatars (16–20px, rounded-full) on every row and chip. Verdict state decorates the avatar (ring color / corner glyph), Reviewable-style.
- Color: teal `primary` for focus and interactive accents (one accent per view), `addition`/`deletion` reserved for verdict/diff/CI truth, amber only for contention. Surfaces come from `card` + `border` layering, not from colored text.
- shadcn primitives first (Card, Badge, Avatar, Tabs, ScrollArea, DropdownMenu, Kbd if present). No hand-rolled focus/keyboard on interactive primitives.
- Animation: none on keyboard-driven actions (j/k focus moves instantly). 150–200ms ease-out only for pane-level enter (dossier swap), compositor props only.
- Screenshot checkpoint at 1440×900 after every visual milestone; compare against the landing for identity coherence before proceeding.

## The screen (one, not four)

One authed home screen: a **single-repo control room**. Three zones across the full width — the two-pane inbox pattern (Linear/Superhuman) plus a compact flow rail. PRs stay "linear bits of work going into a branch": the middle column is grouped by target branch, the left rail shows the promotion topology, the right pane is where decisions happen.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⌘ Sphynx    autumn ▾                                    settings · avatar    │
├───────────────┬──────────────────────────────┬───────────────────────────────┤
│ FLOW (240px)  │ QUEUE (flex)                 │ DOSSIER (~420px)              │
│               │                              │                               │
│ ● main        │ needs decision (3)           │ #2286                         │
│ │  8 inbound  │ ┌──────────────────────────┐ │ fix(emails): use real invite  │
│ │  ◈ in sync  │ │ ◉ #2286 fix(emails)…     │ │ link in org invitation email  │
│ ● dev         │ │   [avatars] 1d · +12 −6  │ │        (Fraunces, text-xl)    │
│    20 inbound │ └──────────────────────────┘ │                               │
│               │  … rows: avatar, title,      │ "claude wants changes"        │
│ john/migr…  2 │  verdict chips, CI, age      │                               │
│               │                              │ verdicts                      │
│ (branch nav — │ waiting on reviews (9)       │ [◯ claude    ✗ 6/10   2h]    │
│  click/1-9 to │  …                           │ [◯ greptile  ✓ 8/10   4h]    │
│  filter queue)│                              │ [◯ charlie   · commented]     │
│               │ shipped, not on main (0)     │                               │
│               │                              │ checks green · 3 files · +12  │
│               │ drafts (1) — collapsed       │ [open pull]  [merge]  [block] │
├───────────────┴──────────────────────────────┴───────────────────────────────┤
│ j/k move · enter open · 1–9 branch · [ ] repo · ⌘k switch                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Flow rail (left).** The repo's branch topology as a compact vertical spine: stages as filled nodes, feature bases hollow, inbound counts, promotion gap state ("◈ 7 commits waiting" / "in sync") between stages. Click or number key filters the queue to that branch. This is the pipeline concept, shrunk to navigation where it belongs.
- **Queue (center).** Sections by reviewer-action, not GitHub state: *needs decision* (contested + ready), *waiting on reviews*, *shipped not on main* (gap PRs), *drafts* (collapsed). Rows are 40–44px: author avatar, title (13px sans, foreground), reviewer verdict chips (tiny avatars with state rings), CI dot, age, diff stat. Focused row: `bg-muted/50` + teal left edge.
- **Dossier (right).** Always visible for the focused PR — this is where width goes to work. Fraunces title, the one-line claim as a headline, the verdict matrix as the largest element (reviewer avatar, name, verdict, parsed score, age of verdict), threads count, CI, diff stat, then actions. Merge/block live here (writes stay untested against live PRs per safety rule).
- **Keyboard.** j/k rows, enter opens the PR workspace, 1–9 selects branch in the rail, `[` `]` cycles repos, ⌘k command palette later. No animation on any of these.

## Phases

1. **Shell** — authed home renders the app shell (header with repo switcher stub, frame, full width, three-zone grid with placeholder panes). Screenshot gate: must look like the same product as the landing.
2. **Queue center pane** — real data, sections, rows with avatars. Screenshot gate.
3. **Dossier** — verdict matrix + actions (merge/block wired but gated). Screenshot gate.
4. **Flow rail** — branch spine + gap state + branch filtering. Screenshot gate.
5. **Keyboard + polish** — keys, focus ring discipline, empty/loading/error states, dossier swap transition, light-theme pass.

Each phase ends with a 1440×900 screenshot reviewed against the binding rules before the next begins. One user check-in per phase, not one per four phases.

## Kept from the reset

- Entire backend (review-queue + pipeline services, dev endpoints, schemas, store, migrations) — unchanged, already tested.
- `/api/dev/*` proxy route and the no-auth dev data path for screenshot iteration.
- Decision semantics (`decide()`, `blockerFor()`, `parseScore()`), readiness/contention/claims math — client libs get recreated as they're rebuilt into the new components.
