# Plan: rearrangeable dashboard panes with dnd-kit + react-resizable-panels

## Goal

Let the user **drag the three dashboard panes to reorder them** (and resize the
splits between them), replacing react-mosaic — which we ripped out because its
Blueprint-era internals, bundled react-dnd, and leaky controlled mode made every
spacing/drag/skeleton tweak fight the library. Keep the cards-on-canvas look
(floating rounded cards, cool palette, blue accent) and all current functionality.

The react-mosaic attempt is preserved on `archive/dashboard-mosaic-react-mosaic`
(commit 38bb321) for reference. The current branch is back to plain
`react-resizable-panels` (`DashboardShell`, commit 5ddd1ce).

## Why this stack (decision, locked with user)

- **react-resizable-panels** — already the `@sphynx/ui` `Resizable` primitive
  (shadcn-native, Tailwind-native, `react-resizable-panels` under the hood,
  actively maintained). Owns the splits + resize + size persistence via
  `autoSaveId`. It does NOT reorder panes — that is dnd-kit's job.
- **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) — the modern, headless,
  Tailwind-friendly DnD standard. Controlled, accessible (keyboard + pointer
  sensors), styleable with our own classes — no black-box CSS to override.
- Composition: **dnd-kit decides the ORDER of panes; resizable-panels lays out +
  resizes them in that order.** They are orthogonal — dnd-kit never touches sizes,
  panels never touches order.

Rejected: react-mosaic (removed — the reason for this plan); Dockview (heavy
chrome to restyle, same class of problem as mosaic).

## Scope decisions (confirm before building)

1. **Rearrange model.** react-mosaic allowed arbitrary tiling (stack two panes in
   a column, nest splits). dnd-kit + a single horizontal PanelGroup naturally
   supports **reordering the three panes left-to-right only** (a sortable row).
   - **Recommended v1: horizontal reorder only** (rail | queue | dossier in any
     order). Simple, robust, covers the main ask. No vertical stacking / nesting.
   - If column-stacking is required later, it becomes a nested PanelGroup problem
     (defer — it is what made mosaic complex).
2. **Arrange mode toggle?** react-mosaic version gated dragging behind an
   "Arrange" toggle so the resting dashboard stayed quiet. Decide: keep the
   explicit toggle, or make panes always draggable from a small grip. Recommended:
   **keep the toggle** (header top-right, matching settings button) — it kept the
   default view clean and users liked it.
3. **Persistence.** Two independent pieces:
   - Pane **order** → dnd-kit result → `localStorage["sphynx-dashboard-order"]`
     (array of pane ids). Small client hook, SSR-guarded.
   - Pane **sizes** → react-resizable-panels `autoSaveId="sphynx-dashboard"`
     (library-managed, already works). Keep as-is.
4. **Reset.** A reset control (only in arrange mode) clears both the order key and
   the panels `autoSaveId` group → default order + sizes.

## Current structure (what we build on)

- `DashboardShell` (`dashboard-shell.tsx`): `<main h-svh>` → mobile `NoticePanel`
  / desktop `md:flex` → header card (`px-2.5 pt-2.5`) → `ResizablePanelGroup
  autoSaveId="sphynx-dashboard" horizontal` with 3 `ResizablePanel`s
  (rail 17/12, queue 53/30, dossier 30/20) + transparent `ResizableHandle`s.
  Each panel wraps its pane in the cards-on-canvas chrome
  (`p-2.5 pt-[13px] …` + `rounded-lg border border-border bg-card shadow-xs`).
- Props (unchanged, keep): `rail`, `queue`, `dossier`, `railFooter`, `switcher`,
  `githubUrl`. Consumed only by `dashboard-view.tsx` (ready-vs-skeleton ternaries).
- Primitive: `packages/ui/src/components/ui/resizable.tsx` (react-resizable-panels).
- Dev harness: `/dev/dashboard` (mock PULLS/FLOW, `beforeLoad: devOnly`) — build
  and verify here first (auth-free, Chrome DevTools screenshots).

## Approach — build on the dev route first, then it IS the shell

### Phase 0 — install
- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` in `apps/web`.
- No CSS library, no backend — dnd-kit is headless. All styling is our Tailwind.

### Phase 1 — pane order state (no DnD yet)
- `use-pane-order.ts`: `order: PaneId[]` state, `readStoredOrder()` (SSR-guarded,
  validates completeness against `["rail","queue","dossier"]`, falls back to
  default), `setOrder` (persists to `localStorage["sphynx-dashboard-order"]`),
  `reset`. Mirror the shape/guards of the old `use-mosaic-layout` but far simpler
  (a flat array, no tree, no hide-collapse edge cases).
- `DashboardShell` renders its `ResizablePanel`s in `order` instead of a fixed
  order. Map `PaneId → { node, defaultSize, minSize }`. The `ResizableHandle`s go
  between them. `autoSaveId` stays for size persistence.
- Verify: panes still resize; order is stable across reload; no DnD yet.

### Phase 2 — dnd-kit reorder (arrange mode)
- Wrap the panel group region in `<DndContext>` with `PointerSensor` +
  `KeyboardSensor` (accessible) and `closestCenter` collision.
- Use `<SortableContext items={order} strategy={horizontalListSortingStrategy}>`.
- Each pane's card is a `useSortable({ id })` node: apply `setNodeRef`,
  `attributes`, `listeners` to a **drag handle** (the whole card in arrange mode,
  or a grip — mirror the old UX), and `transform`/`transition` from dnd-kit for
  the drag animation (CSS transform, GPU, smooth — dnd-kit gives this free).
- `onDragEnd`: `arrayMove(order, from, to)` → `setOrder`. That's the entire
  commit logic — no `createDragToUpdates`, no hide/show, no controlled desync.
- **Critical interaction with resizable-panels:** a Panel's size is keyed by
  order/index via `autoSaveId`. When order changes, keep sizes attached to pane
  IDENTITY not position — give each `ResizablePanel` a stable `id={paneId}` +
  `order={index}` prop (react-resizable-panels supports `order` for reordering).
  This lets a pane keep its width when moved. Verify sizes follow the pane.
- Arrange mode: only mount `DndContext`/sortable listeners when the Arrange toggle
  is on (resting dashboard has zero drag overhead / noise).

### Phase 3 — the arrange affordance (port the good parts)
- Header **Arrange toggle** (top-right cluster, square icon-only outline button
  matching Settings) — reuse the design we landed: primary-tinted active state,
  inline **Reset** button when active. This code is in the archive branch
  (`arrange-toggle.tsx`) — lift it over, drop the mosaic-specific props.
- On-drag visuals (dnd-kit, all Tailwind — no library CSS):
  - Dragged card: `DragOverlay` renders a compact chip OR the lifted card at
    reduced opacity; the source slot shows a placeholder.
  - Other cards slide to make room via dnd-kit's `transform` (built-in, smooth).
  - Ring/primary wash on cards in arrange mode (the treatment the user approved)
    — plain Tailwind classes gated on an `arranging` data attribute.
- Motion: dnd-kit transitions are ease-out and interruptible by default; keep
  <200ms, transforms/opacity only (design-eng skill).

### Phase 4 — wire into the real dashboard
- `DashboardShell` public props stay identical → `dashboard-view.tsx` unchanged.
- Skeletons render as the same pane props → they inherit the saved order + sizes
  instantly (fixes the old "skeleton ignores layout" + "flash of default" issues
  for free, because order/sizes are plain state read synchronously).
- Keep `DashboardCommands` / `WorkbenchSheet` siblings untouched.

### Phase 5 — validate + ship
- `bun run typecheck` · `bun run check` (ultracite) · `bun run knip` ·
  `bun run doctor` (100) · pre-commit tests.
- Chrome DevTools on `/dev/dashboard`: reorder each pairing, resize, reload
  (order + sizes persist), reset, both light/dark themes. Confirm NO pane can
  vanish/collapse (impossible here — order is a flat 3-item array, sizes are
  panel-managed).
- Ship on `feat/dashboard-mosaic` (or rename to `feat/dashboard-rearrange`).

## Why this avoids every react-mosaic bug we hit

| react-mosaic pain | dnd-kit + panels |
|---|---|
| `hide()` collapsing source to 0% via our `onChange` | No hide model; order is `arrayMove`, sizes are panel-managed |
| Drop source overlay blocking drop zones (z-index) | dnd-kit droppables are the sortable items themselves; no overlay conflict |
| Controlled tree desync / "lose a pane on drop" | Order is a validated flat array; a pane can't leave it |
| Blueprint CSS overrides, wide gutters, split-line hacks | Zero library CSS; gutters/handles are our Tailwind `ResizableHandle` |
| Sticky header escaping rounded card | Unchanged from current resizable-panels (already fine) |
| SSR `window` crash → client-only gate | dnd-kit SSR-safe; no gate needed |

## Risks / watch-items

- **Size-follows-identity:** must use react-resizable-panels `id` + `order` props
  so a moved pane keeps its width. Verify explicitly — this is the one non-obvious
  integration point. If it misbehaves, fall back to persisting sizes ourselves in
  the order hook (sizes keyed by pane id).
- **Handle vs drag:** the resize handle (panels) and the reorder drag (dnd-kit)
  must not conflict. Keep them on different targets: handle = the seam between
  panels; reorder drag = the card body/grip. In arrange mode, resize can be
  disabled or kept — decide in Phase 2.
- **Keyboard a11y:** wire `KeyboardSensor` so reordering works without a mouse
  (dnd-kit supports this out of the box; just add the sensor + announcements).

## Files (new / touched)

- New: `use-pane-order.ts`, `pane-sortable.tsx` (or inline in shell),
  `arrange-toggle.tsx` (lift from archive).
- Touched: `dashboard-shell.tsx` (order-driven panels + DnD wrapper),
  `app-header.tsx` (actions slot for the toggle — also in archive),
  `dev/dashboard.tsx` (unchanged consumer; already mock).
- Deps: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
