# PR screen redesign — cards-on-canvas, Mintlify-consistent with the dashboard

## Goal

Make the PR review screen (`/$owner/$repo/pull/$number`) look and feel like it's
the same product as the dashboard: a **full visual reskin** onto the dashboard's
Mintlify-inspired design system, reframed as **cards-on-canvas**, with **no
behaviour changes**. Navigating dashboard → PR should feel like one surface.

Decisions locked with the user:
- **Scope:** full reskin, keep the existing structure/behaviour (header + tabs,
  conversation feed + right sidebar, diff file-tree + columns). No IA rewrite, no
  interaction changes.
- **Framing:** cards-on-canvas — PR content lives in floating rounded cards on
  the dark canvas with the dashboard's gutters, matching the mosaic dashboard.
- Grounded in references (Graphite/GitHub code-review UIs) + the dashboard's own
  locked design DNA.

## Design DNA to apply (from [[dashboard-redesign-direction]], verified in code)

- `--radius: 0.625rem` (cards ~10px, controls ~8px, chips 6px). Use `rounded-lg`
  for cards, `rounded-md` for controls/chips.
- **Card token** (already the dashboard standard): `flex min-h-0 flex-col
  overflow-hidden rounded-lg border border-border bg-card shadow-xs`.
- **Canvas + gutter:** dark `bg-background`, `p-2.5` outer, `gap`/`mb-2.5`
  (~10px) between cards (the dashboard's 10px edge / 13px seam rhythm).
- **Section header pattern** (from queue-pane / dossier-pane): `h-11`, sticky,
  `bg-card`, `border-b`, a `size-5 rounded-md bg-muted/60` icon chip with a
  `size-3` Phosphor **fill** icon, then `font-heading font-medium text-sm
  tracking-tight` label + optional `text-xs tabular-nums text-muted-foreground/60`
  count.
- **Type scale:** metadata `text-xs` (12px), content `text-sm` (14px), page
  title `font-heading text-2xl tracking-tight` (already correct in the header).
- **Palette:** cool-gray, **blue accent** (never green as an accent — green =
  "ready/merged" state only), Phosphor **fill** icons, Geist/Funnel fonts.
- **Cool restraint:** thin 1px borders, `shadow-xs`, `shadow-none` inside cards,
  hairline separators (`border-border`), muted secondary text
  (`text-muted-foreground`, `/60` for tertiary).

## Reference takeaways (Graphite / GitHub code review)

- **Three-zone diff layout** (header · file tree · diff · right tray) — Sphynx
  already has this; we keep it and just recard/restyle it.
- **File tree**: green/red for added/deleted, collapsible, stays oriented when
  collapsed. Sphynx has `FileList`; restyle to the card + h-11 header pattern.
- **Comments to the right of code / focus mode**: Sphynx's conversation already
  has a right sidebar and the diff supards; keep, don't rebuild.
- **Timeline tray on the right**: matches Sphynx's `ConversationOverview` /
  right `aside`. Recard it.
- Don't force cards where code needs width — inside a diff card, the code stays
  edge-to-edge; the *card* provides the frame, not inner padding on code lines.

Sources: Graphite review-PR docs (three-zone layout, focus mode, file tree
color-coding), GitHub PR files view (file tree + unified/split diff).

## Current structure (what we're restyling, file by file)

`PullRequestPage` → `<main>` with:
1. `PullRequestHeader` — `AppHeader` (switcher) + title row + meta row + tabs.
   Currently a flat `border-b` header, full-bleed.
2. Tab = conversation → `ConversationPanel`: centered `max-w-3xl` feed + right
   `w-[26rem]` `border-l` aside (`ConversationCodePane` + `ConversationOverview`).
3. Tab = files → `DiffWorkspace`: optional trail/review bar (`border-b`) + file
   tree `aside` + CSS-grid of `DiffCardList` / `PaneColumn` diff columns
   (`gap-4`, `border-b` chrome).

Everything currently uses **flat `border-b`/`border-l` dividers, full-bleed** —
the opposite of cards-on-canvas.

## The redesign, phase by phase (each phase: build → screenshot light+dark →
verify → keep gate green)

Because the PR screen needs auth, verify with **faithful DevTools repros** of the
component structure with real classes/tokens (same approach the dashboard
redesign used), plus the `/dev/skeleton-pr` fixture where it exercises the real
components.

### Phase 0 — Shared shell + tokens (foundation)

- Introduce the **cards-on-canvas frame** for the PR screen `<main>`: dark
  `bg-background`, `p-2.5`, a column flex with `gap-2.5`. This mirrors
  `MosaicDashboardShell`'s desktop branch.
- Extract a tiny reusable **`PaneCard`** + **`PaneHeader`** (icon-chip + label +
  count/actions) from the dashboard's queue/dossier header pattern into a shared
  dashboard/pull-request-neutral location (e.g. `components/layout/pane-card.tsx`)
  so both surfaces use ONE definition (DRY — charlie rule). Refactor the
  dashboard's queue/dossier headers to consume it in the same phase so we don't
  fork the pattern.
- Keep `AppHeader` as the top bar (shared with dashboard) so the very top of both
  screens is identical.

### Phase 1 — PR header card

- Reframe `PullRequestHeader` as the **top card on the canvas** (like the
  dashboard header card): `AppHeader` row inside a `rounded-lg border bg-card`,
  then the title/meta rows inside it, hairline-separated — not full-bleed
  `border-b`s.
- Title row: keep `font-heading text-2xl`, `#num` in `text-muted-foreground/60`.
  Merge button + refresh stay right-aligned, restyled to dashboard button chrome.
- Meta row: `StatusPill` (blue/neutral/danger tones already correct), author via
  `GithubProfile`, `BranchChip`s, `DiffStat`, viewed `progress` — all `text-xs`,
  hairline dividers, Phosphor fill icons.
- **Tabs** (conversation/files): restyle to the dashboard's segmented look
  (`aria-pressed:bg-primary/10 aria-pressed:text-primary`, `rounded-md`,
  `text-sm`), matching the arrange-toggle / rail chrome. Keyboard shortcuts
  unchanged.

### Phase 2 — Conversation tab as cards

- Wrap the centered feed in a **card column** on the canvas (`max-w-3xl` stays,
  but the feed sits in a `PaneCard` so it reads as a surface, not a bare column).
- The right sidebar (`ConversationCodePane` + `ConversationOverview`) becomes a
  **`PaneCard` with a `PaneHeader`** ("Overview" / "Code", `size-5` icon chip),
  matching the dashboard dossier pane exactly (it already inspired that pane).
- Comment cards (`ConversationCommentCard`, `ConversationReviewCard`,
  event/state rows): restyle to `rounded-lg border bg-card shadow-xs`, `text-sm`
  body, `text-xs` meta, Phosphor fill event icons, blue accents for actionable
  bits. The description card (`ConversationDescription`) matches.
- Composer (`ConversationComposer`): dashboard input chrome (`input-bevel-shadow`,
  `rounded-md`, `h-8` controls).

### Phase 3 — Diff/files tab as cards

- **File tree** (`FileList` / `FileTree`): a `PaneCard` with a `PaneHeader`
  ("Files", count), kept collapsible; added/deleted keep green/red status dots
  (per Graphite), selected row uses `bg-primary/10 text-primary`.
- **Diff columns** (`DiffCardList` + `PaneColumn`): each diff/definition column
  becomes a `PaneCard`. The card header = the file path chrome (`PaneHeader`
  style with the file-type icon chip, `CopyPathButton`, viewed toggle). Code
  lines stay **edge-to-edge inside the card** (no inner padding on code — the
  card is the frame). Gutter between columns = the canvas gap, not `border-b`.
- Trail / review-submit bar: restyle to sit on the canvas as a slim card-header
  strip, hairline not heavy `border-b`.
- `DiffStat`, added/removed counts: blue/danger tones, `tabular-nums`.

### Phase 4 — Skeletons + loading parity

- Update `PullRequestHeaderSkeleton`, `ConversationSkeleton`,
  `DiffCardSkeleton`, `FileListSkeleton` to the **card-shaped** skeletons the
  dashboard uses (reserve the settled card layout, `skeleton-shimmer`), so the
  loading state matches the loaded cards — no shift, consistent with the
  dashboard's skeleton-first philosophy.
- Respect the existing `prefers-reduced-motion` shimmer guard.

### Phase 5 — Motion + polish pass (design-engineer / emil)

- Content/tab entrances: reuse the dashboard's `fade-in animate-in duration-150`
  with the codebase's strong ease-out (`cubic-bezier(0.23,1,0.32,1)`) — no
  animation on keyboard-driven tab switches (used constantly; per the animation
  skill, keyboard actions don't animate).
- Buttons: `active:scale-[0.97]` press feedback, `transition-transform`.
- Hover: subtle, `@media (hover:hover)`; card hover rings only where a card is
  interactive (e.g. file rows), matching the dashboard.
- No `transition: all`, no `ease-in`, all UI transitions <300ms.
- Review with fresh eyes (emil "review the next day") + slow-motion check the
  tab/content crossfade.

## What we deliberately keep (no behaviour change)

- Tab model + all keyboard shortcuts (`use-tab-keys`, `pull-request-commands`).
- Diff engine, worker pool, definition trail/panes, symbol index, viewed state,
  commenting/review flow, freshness/refresh, access banner, switcher.
- The `max-w-3xl` conversation measure and the `w-[26rem]` sidebar width
  (adjust only if a card frame needs it).
- nuqs search-param state (once the dev-server restart clears the optimize issue).

## What we may rip out / simplify

- Flat `border-b`/`border-l` full-bleed dividers → replaced by card edges +
  hairline separators. Delete now-redundant divider wrappers.
- Any bespoke one-off header/toolbar chrome that the shared `PaneCard`/
  `PaneHeader` now covers — collapse into the shared component (DRY).
- Duplicated card class strings → the shared `CARD`/`PaneCard` token.

## Conventions / guardrails (charlie + CLAUDE.md)

- One component per file; extract `PaneCard`/`PaneHeader` as their own files.
- No `//` comments (use `/** */`); `cn` for all conditional classes; no nested
  ternaries; keep components small; no new `useEffect` for derived state.
- Phosphor **fill** icons; cool-gray + blue; `--radius` tokens; `text-xs`/
  `text-sm` scale.
- After each phase: `bun run check` · `bun run typecheck` · `bun run doctor`
  (keep 100) · `bun run knip`. Screenshot light + dark via DevTools repros.
- Commit per phase with a plain message (no AI attribution).

## Open risks / notes

- **Diff width**: cards add a border + radius; verify the diff still has enough
  horizontal room at common widths (the reason full-bleed was considered). If a
  2-column diff feels tight, the diff card can drop its inner horizontal padding
  to reclaim the pixels (the plan already keeps code edge-to-edge).
- **nuqs/vite**: the PR route currently needs the dev-server `--force` restart to
  clear the optimize-deps issue (already fixed in `vite.config.ts`); unrelated to
  the redesign but blocks live verification until restarted.
- The `/dev/skeleton-pr` fixture is the best unauthenticated way to verify the
  reskinned components in the real component tree.
