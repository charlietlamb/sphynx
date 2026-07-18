# Review queue rebuild

## What went wrong

1. **No visual feedback loop.** Three UI iterations (list → board → spectrum)
   shipped without a single rendered check — the browser extension was down and
   building continued anyway. Novel layout math cannot be validated by
   typecheckers.
2. **The spectrum layout is structurally unsound.** Proportional y-positioning
   degenerates on real data: gates cap most scores into a narrow band, which
   renders as one clump of rows under a large empty region. Variable-height
   focused rows inside an absolutely-positioned stack overlap their neighbors,
   and the min-gap collision pass silently destroys the "gaps are data" premise
   the design depended on.
3. **Whole surfaces were shipped at once** instead of iterating one component
   against real data with the user.

## What survives (do not rebuild)

- Server: `review-queue` schema group, tracked/discovered repos, queue +
  verdict endpoints, merge/block writes, `queue-decision.ts`
  (decision/blocker/severity/bot/score parsing — tested), `ReviewQueueStore`.
- Concepts validated by research, to be re-implemented UI-side later:
  - **Readiness ordering**: weighted consensus (humans 2× bots; parsed scores
    temper verdict direction: `0.6·direction + 0.4·(score−5)/5`) + CI + risk +
    threads + coverage, with hard gates (draft ≤ .15; failing CI or requested
    changes ≤ .35) so blocked work can never rank mergeable.
  - **Claims**: deterministic one-line arguments ("claude wants changes",
    "approved 2×, green, 3d old — why is this still open?").
  - **Whisker**: weighted stddev of verdict values = visible disagreement.

## Rules for the rebuild

- **No UI change proceeds without a rendered screenshot checkpoint.** Every
  phase below ends with the user seeing pixels and approving.
- **Normal document flow only.** No absolute positioning, no proportional
  pixel encodings, no variable-height stacks. Cleverness lives in ordering,
  typography, and progressive disclosure — not layout math.
- One component at a time, real data, smallest reviewable step.

## Phases

### Phase 0 — visual verification harness
- Restore a working screenshot loop first: reconnect the Chrome extension, or
  add a dev-only `/design/queue` route rendering fixture `QueuePull` data so
  Playwright/manual screenshots need no auth.
- Exit: a screenshot of the fixture page in the conversation.

### Phase 1 — one perfect row
- A single `QueueRow` in normal flow: claim sentence as primary text,
  `repo#number` mono, reviewer glyph tally, CI dot, diffstat, age.
- Iterate on the screenshot with the user until the row is right.

### Phase 2 — the page
- Ranked flow list under three plain band headings derived from gates + score:
  "Mergeable", "In review", "Blocked" (sentence case, no columns, no kanban).
  Order within bands = readiness. Drafts folded at the bottom.
- Keyboard: j/k through rows, Enter opens the PR, m merges (gated), g/G edges.
- Header: repo manager (auto-detected + manual), settings, user menu.
- Exit: screenshot approval on real data.

### Phase 3 — depth on focus
- Focused row expands in flow (its own height, pushing neighbors): reviewer
  strip with scores, split whisker, gate reason, term breakdown.
- Verdict actions inline (m / b with dialog) — no separate verdict route
  unless the user asks for one.

### Phase 4 — motion and polish
- FLIP-style reorder animation when scores change, entrance transitions,
  empty/loading states. Only after Phases 1–3 are approved.
