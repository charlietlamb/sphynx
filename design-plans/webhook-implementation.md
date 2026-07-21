# Webhooks + read model — implementation plan

Latency is the driver, so this plan does the **minimal, cloud-neutral** path:
webhooks on the Vercel app you already run, writing a **normalized read model**
in Neon. No S3, no CDN blob, no AWS. AWS (SQS + Fargate) is a later durability
upgrade, out of scope here.

Grounded in the codebase, verified this session:
- The web proxy forwards `request.body` as a **stream** (`duplex: "half"`,
  `proxy.ts`), so raw bytes survive intact — signature verification works.
- The Effect server's `Bun.serve` fetch handler branches on pathname *before*
  the HttpApi router (`app.ts:53`), so a raw-body webhook route slots in
  cleanly, outside the API-group machinery.
- Migrations are at `0002`; drizzle-kit `db:generate`/`db:migrate`; schema is
  one file per table with a barrel export in `schema.ts`. New tables follow that
  convention and FK to `github_installation`.

---

## The read path (why this fixes latency)

Today: every dashboard load is a synchronous GitHub fan-out — cold ~5s.
After: the dashboard reads **materialized rows from Neon** — sub-100ms, never
touches GitHub. Webhooks keep the rows fresh (45s → ~1s). The existing pipeline
survives as backfill + reconcile, not the live driver.

---

## DB schema — normalized

Design goals: third-normal-form where it earns its keep, no giant JSON blob as
the source of truth, every derived aggregate stored as its own rows so a single
webhook can update exactly what changed. Nesting mirrors the domain:
**installation → repo → pull → (reviewer | check | thread)**, plus a separate
**stage_gap** because gaps are cross-branch, not per-PR.

All tables live in `packages/db/src/schema/review/` (one file each), export
through `schema.ts`, and FK to `github_installation` (installation-global state,
`installation_id` is the partition key everywhere).

### `review_repo` — repos seen in an installation
```
review_repo (
  id              text primary key,           -- `${installation_id}:${owner}/${repo}` or a uuid
  installation_id integer not null            -- FK github_installation.installation_id (cascade)
                    references github_installation(installation_id) on delete cascade,
  owner           text not null,
  repo            text not null,
  default_branch  text,
  stages          text[] not null default '{}', -- resolved stageChain (dev/staging/main…)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (installation_id, owner, repo)
)
index (installation_id)
```
Why a table and not a column on the pull: repo-level state (`stages`,
`default_branch`) is shared by all its pulls, and `stage_gap` FKs to it.

### `review_pull` — one row per open pull (the queue's spine)
```
review_pull (
  id                   text primary key,       -- `${repo_id}:${number}`
  repo_id              text not null references review_repo(id) on delete cascade,
  installation_id      integer not null,       -- denormalized for the hot read index
  number               integer not null,
  state                text not null,          -- 'open' | 'closed' | 'merged'  (enum)
  title                text not null,
  author_login         text,
  author_avatar_url    text,
  is_draft             boolean not null default false,
  base_ref             text not null,
  head_ref             text not null,
  additions            integer not null default 0,
  deletions            integer not null default 0,
  changed_files        integer not null default 0,
  ci_state             text not null default 'none',   -- success|failure|pending|none (enum)
  decision             text not null,          -- ready|contested|needs-eyes|draft (enum)
  blocker              text,
  has_body             boolean not null default false,
  ai_score             text,                   -- parsed from review/comment bodies (nullable)
  gh_updated_at        timestamptz not null,   -- GitHub's updated_at: staleness watermark
  fetched_at           timestamptz not null,   -- OUR clock at fetch: robust watermark (CI-safe)
  updated_at           timestamptz not null default now(),
  unique (repo_id, number)
)
index (installation_id) where state = 'open'   -- the hot dashboard read
index (repo_id)
```
`installation_id` is denormalized onto the pull (not just reachable via
`review_repo`) so the dashboard's `WHERE installation_id = $1 AND state='open'`
is a single partial-index scan — no join for the common read. `ci_state` and
`decision` are promoted columns (filtered/sorted); the fully-derived pieces live
in child tables below rather than a JSON blob, so a review webhook updates one
reviewer row, not a rewritten document.

### `review_reviewer` — verdicts per pull (aggregate → rows)
```
review_reviewer (
  pull_id      text not null references review_pull(id) on delete cascade,
  login        text not null,
  kind         text not null,                 -- 'human' | 'bot'
  avatar_url   text,
  state        text not null,                 -- approved | changes-requested | commented
  score        text,                          -- per-reviewer AI score if present
  submitted_at timestamptz not null,
  primary key (pull_id, login)                -- latest-per-author, matches latestReviews
)
```
`approvals` / `changesRequested` / `reviewerCount` are then **derived on read**
or maintained as counters on `review_pull` (see note). Storing one row per
reviewer means a `pull_request_review` webhook upserts exactly one row
(`ON CONFLICT (pull_id, login)`), not a re-serialized array.

### `review_check` — CI contexts per pull (aggregate → rows)
```
review_check (
  pull_id     text not null references review_pull(id) on delete cascade,
  name        text not null,                  -- check/context name
  conclusion  text,                           -- success|failure|neutral|… (nullable=pending)
  details_url text,
  completed_at timestamptz,
  primary key (pull_id, name)
)
```
`ciFailures[]` and `ciCounts{failed,passed,pending}` derive from these rows. A
`check_run` webhook upserts one row keyed `(pull_id, name)`, and `ci_state` on
the pull is recomputed from the set.

### `review_thread` — unresolved-thread state per pull
```
review_thread (
  pull_id          text not null references review_pull(id) on delete cascade,
  thread_id        text not null,             -- GitHub thread node id
  is_resolved      boolean not null,
  root_comment_id  bigint,
  author_login     text,
  author_avatar_url text,
  body_preview     text,                      -- first comment, for threadPreviews
  primary key (pull_id, thread_id)
)
```
`unresolvedThreads` = `count(*) where not is_resolved`; `threadPreviews` = the
unresolved rows. `pull_request_review_thread` resolved/unresolved flips one row.

### `stage_gap` — cross-branch promotion state (NOT per-pull)
```
stage_gap (
  repo_id         text not null references review_repo(id) on delete cascade,
  installation_id integer not null,
  from_stage      text not null,             -- e.g. 'dev'
  to_stage        text not null,             -- e.g. 'main'
  ahead_by        integer not null,
  direct_commits  integer not null,
  promotion_pull  integer,
  computed_at     timestamptz not null default now(),
  primary key (repo_id, from_stage, to_stage)
)
index (installation_id)
-- the PRs sitting in a gap, if we want them queryable rather than derived:
stage_gap_pull (
  repo_id text, from_stage text, to_stage text,   -- FK stage_gap (composite)
  pull_number integer, title text, author_login text, merged_at timestamptz,
  primary key (repo_id, from_stage, to_stage, pull_number)
)
```
Recomputed only on `push` to a stage branch / merge / base-change — the events
no per-pull row can carry. Its own table because a gap belongs to a repo+branch
pair, not a pull.

### `webhook_delivery` — idempotency
```
webhook_delivery (
  delivery_id  uuid primary key,             -- X-GitHub-Delivery
  event_type   text not null,
  installation_id integer,
  received_at  timestamptz not null default now()
)
index (received_at)                          -- for TTL sweep
```
`INSERT … ON CONFLICT DO NOTHING`; the unique PK makes dedup atomic (no TOCTOU).
Sweep rows older than ~48h.

**Normalization notes:**
- No JSON blob is the source of truth. `review_pull` holds scalar/promoted
  fields; every *aggregate* (`reviewers`, `checks`, `threads`) is its own child
  table keyed by pull. This is the whole point of "clean and normalized" — a
  webhook mutates the minimal set of rows.
- Counters like `approvals` can be **derived on read** (a `count` over
  `review_reviewer`) OR **maintained as columns** on `review_pull` recomputed
  when a child changes. Derive-on-read is cleaner (single source of truth, no
  drift between counter and rows); promote to a stored counter only if the read
  query proves slow. Start derived.
- `installation_id` is denormalized onto `review_pull` and `stage_gap` purely to
  make the hot reads index-only. This is a deliberate, documented denormalization
  for the read path, not a modelling smell — the FK to `review_repo` remains the
  structural truth.

---

## Stage 0 — Prerequisite (do first, independent win)

**Per-PR thread split**, already specced: drop `reviewThreads`+`comments` from
the bulk queue GraphQL fragment; fetch thread detail on dossier focus. Halves the
cold load (measured 2.7s→1.3s, cost 24→2 points). ~1 hour. This also shrinks the
pipeline that Stage 1 writes to Neon. Independently shippable.

## Stage 1 — Materialize the read model (no webhooks yet, no AWS)

**Goal:** the pipeline writes normalized rows to Neon on every build, *in
addition to* the in-process cache. Reads still come from the cache. Invisible to
users; establishes the store.

- Add the schema above (`db:generate` → migration `0003` → `db:migrate` on dev,
  then prod).
- A `ReadModelWriter` Effect service: given a built `Pipeline` for an
  installation, upsert `review_repo` / `review_pull` / children / `stage_gap` in
  one transaction per installation. Idempotent upserts (`ON CONFLICT`), gated on
  `gh_updated_at`/`fetched_at` watermark.
- Hook it into the existing `PipelineCache` build path so every refresh also
  persists.
- **Verify:** after a build, the rows reconstruct the same `Pipeline` the cache
  holds. Add a test that round-trips `Pipeline → rows → Pipeline`.

**Ships:** the store exists and is correct. Nothing user-facing yet. Reversible
(additive writes only).

## Stage 2 — Switch reads to Neon + LISTEN/NOTIFY

**Goal:** dashboard reads come from the rows; cross-instance invalidation works.

- A `ReadModelReader`: one indexed query per installation reconstructs
  `Pipeline` (pull rows + children + gaps), sub-100ms. Filters (`is:open`,
  per-repo) pushed into SQL.
- `NOTIFY review_dirty, '<installation_id>'` on write; each container `LISTEN`s
  and drops its in-process copy. **Flag:** Neon's PgBouncer pooler may need a
  direct connection for `LISTEN` — verify; fall back to a short poll of
  `max(updated_at)` if needed.
- Read endpoint sources rows, falls through to `pipeline.currentQueue` only for
  a cold/unmaterialized installation (rail-less first paint + background
  backfill), so the dashboard is never empty.

**Ships:** correct cross-instance reads at single-digit ms. The pipeline is now
the *backfill/reconcile* engine, not the read driver. Flag-reversible to Stage 1.

## Stage 3 — Webhook ingest (the freshness win)

**Goal:** freshness 45s → ~1s. This is the stage the user feels.

**3a. Endpoint.** New raw-body route in the Effect server, branched in the
`Bun.serve` fetch handler *before* the API router (same seam as `isAuthPath`):
- Read raw bytes (proxy already streams the body through, verified).
- Verify `X-Hub-Signature-256` HMAC-SHA256 with `timingSafeEqual`, length-check
  first, **two-secret accept-set** for zero-downtime rotation. 401 on mismatch.
- `INSERT webhook_delivery ON CONFLICT DO NOTHING` — dedup. If duplicate, 202
  and stop.
- Return **202 in <100ms**. No GitHub work inline (keeps us inside the 10s rule).

**3b. Processing.** First cut, simplest correct: the handler marks the
installation (or the affected repo/pull) **dirty** and the existing pipeline
recomputes → writes rows → NOTIFY. This gets the freshness win immediately
without the full incremental projector.

**3c. Incremental projector** (the real payoff, after 3b proves the pipe):
- Map each event to one of two operations (from the event-processing design):
  **re-derive PR #N** (one ~2-point `PullFields` query → `toQueuePull` → upsert
  pull + children) or **recompute repo R's rail** (`/compare` → `gapFor` →
  upsert `stage_gap`).
- **Coalesce** per `(installation, pull)` with a 3-5s debounce so a CI matrix's
  50 `check_run` events collapse to one recompute (in-memory dirty-set,
  single-container).
- Idempotent last-writer-wins on `(gh_updated_at, fetched_at)`.
- **Subscribe** `pull_request`, `pull_request_review`,
  `pull_request_review_comment`, **`pull_request_review_thread`** (thread
  resolution), `check_run`/`check_suite`/`status`, **`issue_comment`** (bot
  scores), `push` (rail), `installation`/`installation_repositories` (backfill).
  The two bolded are easy to miss and make `decision` silently wrong without them.

**GitHub App config (needs you):** set the webhook URL to
`https://www.sphynx.sh/api/github/webhooks`, generate a webhook secret (add to
Vercel env as the primary of the accept-set), subscribe the events above.

**Shadow mode before trusting 3c:** run the incremental projector's output
against a pipeline rebuild, diff, serve the pipeline result, classify
timing-vs-bug mismatches, cut over per-installation only at zero bug-mismatches
over 24-48h of real traffic.

**Ships:** live dashboard. Reversible — 3b (dirty+rebuild) stays as fallback if
3c regresses.

## Stage 4 — Reconciliation backstop

**Goal:** correctness despite best-effort webhooks.

- `pipeline.refresh(token, storedEtag)` on a staggered schedule (active ~2-3 min,
  idle ~15-30 min) via an Effect `Schedule` loop in the container, with a
  **Postgres advisory lock** for leader election (multi-instance safe).
- Nearly free: unchanged installations revalidate via 304s at zero rate-limit
  cost and skip the compare fan-out.
- On `Modified`, field-level diff vs the rows, emit `reconcile.drift{field}`.
- Fold **branch-tip ETags** into the composite so the cheap reconcile catches
  push-drift (stage gaps have no per-PR event).
- Race-safety: watermark + advisory lock + optimistic version so reconcile and
  the live stream never move state backwards.

**Ships:** the drift ceiling. `reconcile.drift → 0 and staying there` is the
metric that proves correctness. This is what makes the whole thing production,
not a toy.

## Stage 5 — Observability (fold into 3-4, not last)

Add Effect `Metric` counters/gauges alongside the existing `TRACE_SPANS`:
`webhook.delivery_lag`, `webhook.signature_failures`, `webhook.dropped{reason}`,
`reconcile.drift{field}`, `state.age{installation}`, `github.graphql_points_per_min`.
Alert on `state.age > 2× reconcile interval` (webhook+reconcile both dead) and
sustained `reconcile.drift{field}` (a mapping bug leaked past shadow).

---

## Sequencing & stop points

| Stage | Ships | Effort | Stop here if… |
|---|---|---|---|
| 0 Thread split | 5s → ~2.5s cold | ~1h | — always do |
| 1 Materialize | store exists | small-med | — |
| 2 Neon reads | sub-100ms reads, multi-instance fixed | med | latency was the only goal and 45s freshness is acceptable |
| 3 Webhooks | 45s → ~1s freshness | med-large | **most orgs stop here** |
| 4 Reconcile | correctness ceiling | med | required before trusting 3c incremental |
| 5 Observability | know it's correct | small, ongoing | — fold into 3-4 |

**Do not add AWS (SQS/Fargate)** until missed-delivery drift or deploy-window
loss actually bites in production. The Vercel-container + Neon path carries a
handful-to-hundreds of orgs. AWS is a durability upgrade, sequenced separately
when the metrics justify it.

## Flagged before building
- Neon LISTEN/NOTIFY across PgBouncer — verify direct connection or poll fallback.
- Single-PR `PullFields` point cost — confirm ~2pts before sizing rate budget.
- GitHub webhook redelivery retention window — affects outage-recovery precision
  only (reconcile is the guarantee), not correctness.
- Derive-on-read vs stored counters for `approvals`/`unresolvedThreads` — start
  derived; promote only if the read query measures slow.
