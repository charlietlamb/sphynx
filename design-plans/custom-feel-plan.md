# Custom-feel plan — Mintlify/Firecrawl DNA, mono restraint, clean claims

Sources: forensic teardown of ~/Documents/mintlify (dashboard) and ~/Documents/firecrawl (firecrawl-web), typography audit of the sphynx dashboard, claims copy redesign. This plan is the agreed direction; each phase ends with a screenshot gate.

## Why sphynx reads "generic shadcn" today

1. Borders are uniform and loud — one 17% white for everything. Both references run ~7–10% with three tiers. Loud uniform hairlines are the #1 wireframe tell.
2. Hovers are solid `accent` slabs instead of 2–4% white washes.
3. Everything metadata is 10–11px mono muted gray — no hierarchy inside the metadata, so it reads terminal soup, not design.
4. No signature details: default radii, default focus rings, no motion system, flat primary button.

## Phase A — foundation tokens (globals.css only)

- Border tiers: `--border-faint: oklch(1 0 0 / 7%)` (pane dividers, rows), `--border: 10%` (controls), `--border-loud: 15%` (hover/emphasis). Panes move to faint.
- Surfaces: base drops to `oklch(0.145 0.004 285)`; panes stay flat at base; `--card 0.185` / `--popover 0.205` reserved for true floating surfaces only.
- Alpha ladder for interaction: `--alpha-2/4/6/8` = white at 2/4/6/8%; row hover = alpha-2, ghost hover = alpha-4, active = alpha-6. Kill solid accent hovers.
- Motion system: default easing `cubic-bezier(0.25, 0.1, 0.25, 1)`, 200ms; press feedback 50–100ms, `active:scale-[0.99]` on buttons. One material everywhere.

## Phase B — typography reset (the mono rule)

**Rule: mono is for strings a machine owns. Sans (with `tabular-nums`) owns everything human — including numbers.**

Stays mono: `#1826`, branch names, file paths, CI check names, kbd caps. Goes sans: ages, scores, counts, diffstats, statuses, usernames, section labels, hint words, "in sync with main".

Queue row right cluster → **exception slot** design:
- One shared slot that renders only when something is wrong: `✕ ci` red on failure, `3/5` amber/red on weak score (worst wins). Pending CI = small amber dot in the same slot. Success/none render nothing.
- Scores show **only below max** — a column of green 5/5 is non-signal. Full numerals stay in the dossier matrix (switched to sans).
- Size class XS–XL → 5-step tick bar (`▮▮▯▯▯`, 3×9px ticks, filled 50% / empty 15%), tooltip carries "M · 342 lines · 3 files". Dossier keeps verbal stats, drops the uppercase letter.
- Age in sans 11px muted.
- Clean row = avatar, id, title, reviewer stack, tick bar, age. Red/amber becomes rare — which is what makes it scannable.

Section labels → one editorial caps style everywhere (sans, not mono):
`text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60` → VERDICTS · FLOW · OPEN THREADS · FAILING.

## Phase C — claims rewrite (next-step framing)

`claimFor` returns `{ status, detail, tone }`:
- **status**: verb-led verdict ≤24 chars, 14px semibold, tone-colored: "Ready to merge" / "Fix failing checks" / "Waiting on changes" / "Resolve open threads" / "Waiting for review" / "Draft".
- **detail**: muted evidence fragments joined by `·`: "Approved by charlietlamb · idle 15 days", "ci/test, lint", "Requested by cubic". No snark, no "1×", no rhetorical questions — staleness is the data "idle 15 days", never a personality.
- **tone**: ready | blocked | waiting | neutral — drives status color AND queue-row indicator color from one enum so surfaces can't disagree.
- Drop the redundant draft chip in the dossier header (claim owns draft state). Claims stay out of queue rows.

## Phase D — signature details (the wow)

- **Corner ticks** at pane intersections (Firecrawl `curvy-rect`): 9px quarter-tick in `--border-loud` at pane corners, CSS-only pseudo-element. Highest wow-per-effort; turns the grid into a drafting-blueprint identity.
- **Primary button glow** (teal-ified Firecrawl stack): inset bottom glow + 3 tight teal shadows + white gradient overlay at 6% (8% hover, 0 on 50ms press).
- **Popovers**: ring-in-shadow (`0 0 0 1px white/5%` + two soft blacks), `rounded-xl p-1`, no border — floating surfaces get shadow, in-flow panes keep hairlines.
- **Focus rings**: neutral `0 0 0 2px white/14%` for buttons/menus; teal ring reserved for text inputs.
- **CI status live dot**: pending = amber dot with `animate-ping` twin; failure static red. Status as colored text + dot, never filled pills.
- **Selection style**: selected nav/branch = `text-primary bg-primary/5`; no filled accent blocks.
- Type polish: 13px/20 UI text with `tracking-[-0.1px]`, labels at weight 450 (Geist Variable), Fraunces `-0.01em`. Mintlify shimmer skeletons; big-icon-at-40% empty states.

## Deliberately not adopting

- Firecrawl's ASCII drifting-glyph background — too loud for a review tool; the mountain texture already owns marketing surfaces.
- Composed health glyphs per row — forces users to learn an encoding.
- Uppercase mono micro-labels (Firecrawl's) — conflicts with the mono-restraint rule; the caps+tracking texture comes from sans instead.

## Order

A (tokens, one pass) → B (typography + row redesign) → C (claims) → D (signature details). Screenshot gate per phase against the references.
