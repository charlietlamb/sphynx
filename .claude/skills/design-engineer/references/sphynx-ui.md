# Sphynx UI patterns

The house visual language, derived from the shipped codebase. Match these before
inventing. Every rule below cites where it already lives.

## Icons

Phosphor only, imported from `@phosphor-icons/react`.

| Context | Size | Weight | Color |
| --- | --- | --- | --- |
| Row / list item | `size-3.5`–`size-4` | `weight="fill"` | `text-muted-foreground`, or `text-addition` / `text-deletion` for state |
| Section header (`SectionHeader` `icon=`) | `size-3` | `weight="fill"` | supplied by the component (`text-muted-foreground/60`) — pass none |
| Caret / disclosure | `size-3` or `size-2.5` | default | `text-muted-foreground` + `transition-transform` and `rotate-180` / `rotate-90` when open |
| Inline micro-glyph | `size-2.5` | `fill`, or `bold` for ✕ | semantic color |

Icons are unwrapped flex children with `shrink-0` when siblings truncate. Do not
wrap in a sizing `<span>`; `SectionHeader` and `StatGlyph` are the only components
that mute an icon via a wrapper.

Exemplars: `pull-request/conversation-event-row.tsx`, `pull-request/verdict-icon.tsx`,
`dashboard/dossier-pane.tsx` (failing checks).

## State: geometry over words

Dense rows express state as **colored geometry with the label in a tooltip**, not
as visible icon+text pairs.

- 5px square — `size-[5px] rounded-[1.5px]` + a `bg-*` class.
  See `workbench/workbench-copy.ts` `WORKBENCH_GLYPHS`.
- 1.5px dot — `size-1.5 rounded-full`, `animate-pulse` while pending.
  See `dashboard/dossier-signals.tsx`.
- Ringed dot on a rail — `size-[9px] rounded-full border-2 bg-background`.
  See `dashboard/rail-branch.tsx`.

Wrap any glyph in `SignalTip` to attach its label. That is the codebase's answer to
"icon + label" in dense rows.

Semantic colors: `addition` (green) for success/granted/merged, `deletion` (red) for
failure/blocked, `primary` for opened/active, `foreground/20`–`/25` for neutral.
Never raw Tailwind palette colors — `amber-500` for "running" is the one exception.

## Repetition is noise

If a column repeats the same word on every row, replace it with a glyph. Six rows
each reading "granted" carries no information; six green `CheckCircleIcon`s read
instantly and let the eye land on the rows that differ.

Corollary: when rows each carry a distinguishing leading icon, separators become
redundant. Prefer `gap-1` + row padding over `divide-y`.

Exemplar: `settings/settings-access.tsx`.

## Controls

Solid controls (search fields, dropdown triggers, buttons) share one material:

```
input-bevel-shadow border-border bg-background dark:bg-input/30
hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20
h-7 rounded-md
```

`input-bevel-shadow` is a real token in `apps/web/src/styles/globals.css` — a 1px
top-light inset that makes controls read as material rather than outlines.

Two families, chosen by prominence:

- **Solid** — primary controls the user reaches for. `Button` `variant="outline"`,
  `Select` trigger, the queue search field.
- **Chrome-on-demand** — transparent border at rest, `hover:border-border`,
  `data-[state=open]:border-border`. For controls that shouldn't compete at rest.
  See `dashboard/repo-switcher.tsx`.

Never hand-roll a control that a primitive covers. `Switch`, `Select`, `Badge`,
`Kbd`, `Command`, `DropdownMenu` all exist in `@sphynx/ui`.

## Base UI positioning

`DropdownMenuContent` already applies `w-(--anchor-width)`, `max-h-(--available-height)`,
and `origin-(--transform-origin)`. Do not override with a fixed width — a menu wider
than its trigger is almost always an override fighting the primitive.

Give a trigger whose label changes a fixed width plus `justify-between` and a
truncating label, so it doesn't resize on selection.

## Typography

- `text-[13px]` — row titles, primary list content
- `text-xs` / `text-[11px]` — descriptions, metadata, state labels
- `font-mono` — branch names, scope identifiers, check names, file paths
- `font-heading` — page and dialog titles only
- `tabular-nums` — any number that updates in place

Lowercase for metadata labels (`draft`, `granted`, mono section headings). Sentence
case for user-facing prose.

## Layout

- Sticky headers: compute the offset from the header's real height and pin children
  below it (`top-[37px]`, `z-[9]` under the header's `z-10`). Changing header padding
  breaks this — update both.
- Full-bleed rows in a padded pane: `-mx-4 w-[calc(100%+2rem)]` with padding restored
  inside. Indent nested rows with inline `paddingLeft`, never a wrapper with its own
  margin, so the background still bleeds.
- Skeletons must mirror the real layout's boxes and heights, or content shifts on load.

## Motion

`fade-in animate-in duration-150`, optionally `slide-in-from-top-1`. Transitions are
`transition-colors` unless something genuinely moves. Nothing bounces, nothing is
slower than 150ms.
