# Plan: rearrangeable dashboard panes with react-mosaic

## Goal

Let the user **drag the dashboard panes to rearrange them** (reorder, move a pane
into another column, stack two in one column, split), replacing the fixed
`react-resizable-panels` 3-column layout — **while keeping every bit of the
cards-on-canvas redesign** (rounded cards on a recessed canvas, subtle borders,
roomier spacing, unified dossier, cool palette / blue accent / Phosphor fill
icons). Layout persists across reloads.

## Why react-mosaic (decision, locked with user)

- Tiling window-manager model fits a 3-pane review tool (no free-floating chaos).
- `react-mosaic-component@7.0.0`, peer `react: 16–19` → compatible with React 19.2.4.
- **Self-contained DnD**: bundles `react-dnd` + html5/touch backends as its own
  deps — no separate DnD install, no app-wide DnD provider needed.
- **Blueprint theme is OPTIONAL** (peer). We skip Blueprint entirely and use
  `className=""` + our own scoped CSS overrides → full control of the look.
- Ships TypeScript types (`./index.d.ts`) — no `@types` package.
- **Not yet installed** anywhere.

Rejected: Dockview (heavier tab/group chrome to restyle), FlexLayout (finance-y),
free-floating docks (wrong model for this tool).

## Non-negotiable constraints (from the current shell — must preserve)

The layout is a strict `min-h-0` flex chain from `h-svh` down. Each mosaic tile
must reproduce this or panes collapse / scroll breaks:

- **Full-height chain**: every level carries `min-h-0`; tiles need `height:100%`
  + `min-h-0` ancestors so inner `overflow-y-auto` clips instead of growing the page.
- **Card chrome string reused everywhere**:
  `overflow-hidden rounded-lg border border-border bg-card shadow-xs`
- **Dossier** (`dossier-pane.tsx`): brings its OWN card
  (`fade-in flex h-full min-h-0 animate-in flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs`).
  Its tile must be a bare `h-full min-h-0` box with **no** extra card/border.
- **Queue** (`queue-pane.tsx`): shell supplies the card + the scroll region; pane
  content is `flex min-h-full flex-col px-4 pb-2` (note `min-h-full`, grows past
  viewport → the SHELL's outer scroll container scrolls, and the pane's
  `sticky top-0 bg-card` header depends on that scroll ancestor). Tile pattern:
  tile → card → `min-h-0 flex-1 overflow-y-auto` → `{queue}`. Don't double-nest scroll.
- **Rail** (`flow-rail.tsx`): card body (`min-h-0 flex-1 overflow-y-auto`) PLUS an
  out-of-scroll `railFooter` pinned below inside the same card (`border-t`,
  `h-9 shrink-0`). Keep footer OUTSIDE the scroll region.
- Classes to carry into each tile: `flex flex-col h-full min-h-0`; scroll regions
  `flex-1 overflow-y-auto no-scrollbar`.
- **Header card** stays OUTSIDE the mosaic (it's the top bar, not a rearrangeable
  tile): `px-2.5 pt-2.5` wrapper → card. Mosaic occupies the region below it.
- Gutter today = asymmetric `p-2.5 + pr-1.5/px-1.5/pl-1.5` + `pt-[13px]` optical
  offset. Mosaic has its own gap/split model → replace this padding scheme with
  mosaic tile spacing but keep the SAME visual gutter width (~13px) and the
  header's 10px/13px optical offset.

## Current structure (what we're swapping)

- `dashboard-shell.tsx`: `<main h-svh>` → mobile `NoticePanel` / desktop `md:flex`
  → header card → `ResizablePanelGroup autoSaveId="sphynx-dashboard" horizontal`
  with 3 `ResizablePanel`s (rail 17/12, queue 53/30, dossier 30/20) + transparent
  `ResizableHandle`s.
- Consumed by `dashboard-view.tsx` (props = ready-vs-skeleton ternaries for
  dossier/queue/rail/railFooter/switcher). Rendered in `dashboard-page.tsx` inside
  `<DialogProvider registry={{blockPull, mergePull}}>`. Siblings: `DashboardCommands`
  (before), `WorkbenchSheet` (after).
- Primitive: `packages/ui/src/components/ui/resizable.tsx` wraps
  `react-resizable-panels@3.0.6`.
- **Persistence**: ONLY `autoSaveId="sphynx-dashboard"` → localStorage (library
  internal). `use-dashboard-state.ts` holds NO layout geometry (only data/selection).
  `useSettings()` (`settings-provider.tsx`) is the other localStorage consumer.
  → Migrating orphans the `sphynx-dashboard` key (harmless); mosaic introduces its
  own `MosaicNode` tree to persist separately.
- **Dev harness**: `/dev/dashboard` (`beforeLoad: devOnly`, mock PULLS/FLOW,
  no auth) already mirrors the real consumer (same DialogProvider + real panes).
  **This is where we build + verify mosaic first.**

## Approach — build on the dev route first, then promote

### Phase 0 — install (contained)
- `bun add react-mosaic-component@7` in `apps/web`.
- Import its base CSS **once** (needed for split/resize mechanics) — but scope our
  overrides so the default `.mosaic-window` chrome never shows. Likely import the
  CSS in the dashboard shell module (or globals) and immediately neutralize the
  default window/toolbar/split-handle styles.

### Phase 1 — the mosaic shell, on the dev route only
Build a `MosaicDashboardShell` (new component) used by `/dev/dashboard`:
- `<Mosaic>` with `renderTile={(id, path) => <tile>}` — bypass `MosaicWindow`'s
  default toolbar entirely; render our existing card markup as the tile body.
- Tile ids: `"rail" | "queue" | "dossier"`. `renderTile` maps id → the matching
  pane wrapped in the exact card chrome + scroll pattern from the constraints above.
- Initial `MosaicNode` tree = current layout: row split rail | (queue | dossier)
  with the same ~17/53/30 proportions (`splitPercentage`).
- Header card stays above the `<Mosaic>` (not a tile).
- Wire `onChange`/`onRelease` to persist the tree.

### Phase 2 — restyle mosaic to cards-on-canvas
- Override react-mosaic's default CSS (scoped under a `.sphynx-mosaic` root class):
  - Kill the default window border/toolbar/box-shadow.
  - Style `.mosaic-split` (the resize handle) as a **transparent ~13px gutter**
    matching the current seam — hover shows a subtle `bg-border` line (mirrors the
    current `data-[resize-handle-state]` behavior).
  - Ensure tiles are `height:100% min-h-0` so the flex chain + internal scroll work.
  - Drag preview: style the `.mosaic-drop-target` / drop-zone highlights to use
    `bg-primary/10` + rounded, matching the row-focus accent — apply the animation
    principles (ease-out, <200ms, no scale-from-0).
- Verify in `/dev/dashboard` via Chrome DevTools screenshots (dark + light):
  drag rail into the dossier column, stack queue+dossier, reorder — confirm cards,
  gutters, scroll, and the header stay correct.

### Phase 3 — persistence
- Persist the `MosaicNode` tree. Cleanest: add a `dashboardLayout` field to
  `ReviewSettings` (`settings.ts`) so it rides the existing `sphynx-settings`
  cookie/localStorage the app already manages (SSR-safe, same as other prefs) —
  OR a dedicated `localStorage["sphynx-dashboard-mosaic"]` if we don't want it in
  settings. Prefer settings for consistency.
- Provide a "reset layout" affordance (command palette action or a small control)
  that restores the default tree.
- On first load / no stored tree → default 3-column tree.

### Phase 4 — promote to the real dashboard
- Swap `DashboardShell` internals to render `MosaicDashboardShell` for the desktop
  branch (keep the `md:hidden` mobile `NoticePanel` untouched — mosaic is desktop-only).
- Keep `DashboardShell`'s public props (`dossier/queue/rail/railFooter/switcher/
  githubUrl`) identical so `dashboard-view.tsx` is unchanged. The rail tile must
  still stack `rail` body + `railFooter` in one card.
- The `DialogProvider`, `DashboardCommands`, `WorkbenchSheet` siblings are untouched.

### Phase 5 — validate + ship
- `bunx turbo run typecheck` · `biome check` · `bunx turbo run knip` ·
  `bunx react-doctor` (keep 100) · tests.
- Verify BOTH themes and BOTH the dev route and (via cookie-injected DevTools or
  user review) the real dashboard.
- Ship on a **branch/PR**, not main (user preference). Likely stack on
  `feat/dashboard-cards-on-canvas` or a fresh `feat/dashboard-mosaic`.

## Risks / watch-items

- **Mosaic default CSS clash** — its `.mosaic-window` chrome + split handle will
  fight the `bg-transparent` seam look. Mitigation: bypass `MosaicWindow`, override
  CSS scoped under our root class. Highest-effort part.
- **Scroll ancestor** — the queue's `sticky` header + `min-h-full` content need the
  card's scroll region to be the scroll port; if mosaic makes the TILE the scroll
  container, don't nest a second one.
- **DnD footprint** — mosaic pulls react-dnd + backends; contained, but verify no
  conflict with pierre diffs / other drag interactions elsewhere (dashboard only).
- **Keyboard/focus** — the queue's j/k/enter keymap and focus-scroll
  (`STICKY_HEADER_OFFSET`) must still work inside a mosaic tile; verify the scroll
  container `.closest("section")` lookup in `queue-row.tsx` still resolves (it uses
  `row.closest("section")` — mosaic tile markup may not be a `<section>`; may need
  to adjust that selector).
- **react-doctor / knip** — new component + CSS import; keep the dev route's
  factory helpers hoisted (already fixed `noop`).

## Design principles to hold throughout (from the loaded skills)

- **Motion**: drag/drop feedback ease-out, <200ms, never scale-from-0; the drop
  target uses opacity+subtle scale, not a hard snap. Resize handle: instant, no
  animation (high-frequency interaction).
- **Unseen details compound**: gutters exactly consistent, tiles align, no double
  borders, drop zones read as the same blue accent as row focus.
- **Density vs air**: keep the cards-on-canvas breathing room; mosaic must not
  reintroduce cramped edges.
- **Don't over-animate** rearranging (occasional action → standard, not delightful).

## Decisions (locked with user)

1. **Persistence**: dedicated `localStorage["sphynx-dashboard-mosaic"]` key
   (client-only; a small mounted hook reads on init, writes on `onChange`). NOT in
   ReviewSettings. Guard for SSR (`typeof window`).
2. **Min tile sizes**: KEEP minimums — dossier ~20%, queue ~30%, rail ~12% (mirror
   today's `minSize`). Enforce via mosaic split constraints / clamping in `onChange`.
3. **Mobile**: STACKED single-column fallback below `md` (not the NoticePanel).
   Render the three panes stacked in one scrollable column, no rearranging. Extra
   work vs NoticePanel but usable on mobile — replaces the current `md:hidden`
   NoticePanel branch.
