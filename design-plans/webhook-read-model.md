# Webhook-driven read model — architecture plan

Synthesized from five parallel deep investigations (ingest, storage, event
processing, reconciliation, topology), each grounded in facts measured against
live GitHub this session. Where the five agreed, it's stated as settled. Where
they corrected the original premise, that's called out explicitly.

## The one-sentence answer

Build a **materialized read model in Postgres**, kept fresh by **webhooks that
refetch one PR at a time**, with a **cheap reconciliation sweep** as the
correctness backstop. This is **cloud-neutral** — AWS contributes exactly one
durable queue, and only once volume justifies it. "Move to AWS" is ~80% a
distraction from the change that actually delivers the win.

## Three corrections to the original instinct

The instinct was: "keep state in S3, serve lightning-fast, only update on
webhook, never refetch." Each clause needs adjusting:

1. **S3 is the wrong store — use Postgres.** S3 conditional writes (GA Nov 2024)
   *can* make a blob safe, but you'd be hand-building optimistic concurrency on a
   200KB+ object, rewriting the whole installation on every event, and losing all
   SQL query pushdown (`is:open`, per-repo, search). Postgres gives atomic
   per-PR upserts, snapshot reads (no torn state), LISTEN/NOTIFY for
   cross-instance invalidation, and it's already provisioned. S3+CloudFront
   earns a place only later, as an optional purged read-blob — never as the
   source of truth.

2. **"Never refetch" is not achievable — "refetch one PR" is the sweet spot.**
   The queue's fields (`reviewers`, `ci`, `unresolvedThreads`) are aggregates
   over 20-element GraphQL connections. A webhook payload carries *one* review /
   *one* check / *one* comment — you physically cannot rebuild a 20-element
   aggregate from one element. So on any aggregate-touching event, do a single
   ~2-point GraphQL fetch of that one PR and feed it through the existing
   `toQueuePull`. Spend points (budget is 9050/hr), not complexity.

3. **Webhooks alone drift — a reconciliation sweep is non-negotiable.** Missed
   deliveries, out-of-order application, and silent event→state mapping bugs all
   leave the dashboard wrong indefinitely without a backstop. The reconcile
   interval is the *hard ceiling on how wrong the dashboard can be*.

## Why this is far less work than it looks

**~90% of the hard domain code is reused verbatim.** `toQueuePull`, all of
`queue-decision.ts` (decision/blocker/scores), and the rail functions
(`gapFor`, `flowFromRefs`, `restCompare`, `lookupPulls`) are pure functions.
The projection is a thin new consumer that *calls* them. The existing
`pipeline.refresh(token, etag)` already does the conditional-request dance and
already returns `Modified | NotModified` — it becomes the backfill + reconcile
engine, not deleted.

## Architecture

```
GitHub ──webhooks──▶  ingest endpoint
                        │  verify X-Hub-Signature-256 (constant-time)
                        │  dedupe X-GitHub-Delivery (Postgres unique constraint)
                        │  return 202 in <100ms  (NO GitHub work inline)
                        │  enqueue thin envelope
                        ▼
                     durable queue (SQS Standard — NOT FIFO)
                        │
                        ▼
                     event processor (warm Effect consumer)
                        │  coalesce per (installation, pr) — CI burst 50→1
                        │  refetch ONE pr (~2 pts) OR recompute rail (/compare)
                        │  idempotent last-writer-wins upsert
                        ▼
                     Postgres read model (source of truth)
                        │  pr rows + stage_gap rows, keyed by installation
          ┌─────────────┼──────────────┐
          ▼             ▼               ▼
   read = SELECT   LISTEN/NOTIFY    reconcile sweep
   (sub-100ms,     ──▶ invalidate    (cheap: 304s cost 0,
    never GitHub)  reader caches      catches all drift)
```

### Layer 1 — Ingest

- New route (on the existing container first; a Lambda Function URL if the
  backend leaves Vercel). Read **raw bytes before any parsing** (HMAC is over
  raw body), verify `X-Hub-Signature-256` with `timingSafeEqual`, reject 401 on
  mismatch. Support a **two-secret accept-set** so rotation drops zero deliveries.
- Dedupe: `INSERT delivery_id ON CONFLICT DO NOTHING` (unique constraint is
  atomic, no TOCTOU). Best-effort only — the processor is idempotent regardless.
- Enqueue a thin envelope `{delivery_id, installation_id, event_type, action,
  repo, pr_number?}`, return **202**. All GitHub work happens off the request
  path, which is what keeps us inside GitHub's 10s-or-disabled rule.

### Layer 2 — Queue: Standard SQS, not FIFO

The crux, and all agents agreed: **FIFO is the wrong choice.** GitHub gives no
ordering guarantee, so FIFO would faithfully preserve a *meaningless*
received-order. Ordering is instead enforced **at the write**, by the data's own
monotonic clock (last-writer-wins on `updated_at`/`fetchedAt`). That makes the
transport free to shuffle and duplicate. Standard SQS is cheaper, higher
throughput, and its at-least-once + unordered semantics are exactly what an
idempotent processor tolerates. DLQ after 5 receives with an alarm; visibility
timeout ~60-90s with heartbeat extension for long rebuilds.

### Layer 3 — Event processing

Per-event mapping funnels into just **two idempotent operations**:
- **"Re-derive PR #N"** — one targeted `PullFields` GraphQL query → `toQueuePull`
  → overwrite the slot. Triggered by opened/synchronize/reopened, review,
  review_comment, review_thread, check_run/suite/status.
- **"Recompute repo R's rail"** — `/compare` between stage branches → `gapFor`.
  Triggered *independently* by `push` to a stage branch, merge, base-change. No
  PR event carries this.

Pure-payload shortcuts (no refetch): `ready_for_review` (flip isDraft),
`edited` (title/body), `closed` (remove row).

**Idempotency/ordering — three guards:**
1. Delivery dedupe table (kills retries).
2. Watermark on `(updated_at, fetchedAt)` — reject stale out-of-order writes.
   `fetchedAt` (our own clock at fetch time) is the robust key because
   `check_run` events may not bump the PR's `updated_at`.
3. Pure-overwrite apply (no counters to double-count) — duplicates converge.

**Coalescing:** a CI matrix fires ~50 `check_run` events per PR. A dirty-set
keyed `(installation, pr)` with a 3-5s debounce collapses them to ONE recompute.
In-memory now (single container); a Postgres `pending_recompute` table with
`SKIP LOCKED` once multi-instance.

**Two events the original scope missed** — must subscribe or `decision` goes
silently wrong: `pull_request_review_thread` (only signal that *lowers*
`unresolvedThreads`) and `issue_comment` (bot AI scores can land as PR comments,
which `parseScore` reads).

### Layer 4 — Storage: Postgres, row-per-PR

```
pr(installation_id, repo_id, pr_number PK,
   state, title, author, gh_updated_at,      -- promoted for filter/search/watermark
   ai_score, ai_verdict, decision,           -- derived, stored
   payload jsonb,                            -- the other ~22 QueuePull fields
   fetched_at)
  partial index WHERE state='open'; gin index on title||author for search

stage_gap(installation_id, repo_id, base_branch, head_branch PK,
          ahead_by, behind_by, pr_numbers[], computed_at)   -- cross-branch, its own table

ingested_delivery(delivery_id uuid PK, received_at)          -- idempotency
```

Additive — no auth-table changes. Read = one indexed `SELECT WHERE
installation_id = $1`, filters pushed into SQL, sub-100ms cold. Derived state
rule: if the inputs are all in the event, compute-at-write and store both raw +
derived (AI scores); if it needs a separate fetch/trigger, model it as its own
recomputed row (stage gaps). **Never derive on read** — the read contract is
"never touches GitHub."

### Layer 5 — Reconciliation (the correctness backstop)

`pipeline.refresh(token, storedEtag)` already *is* a reconciler. Run it on a
staggered schedule (active installs ~2-3 min, idle ~15-30 min). It's nearly
free: an unchanged installation revalidates via 304s at **zero rate-limit cost**
and skips the expensive compare fan-out entirely. On `Modified`, field-level
diff vs the materialized state, emit `reconcile.drift{field}`.

**Race-safety** (reconcile reads at T, writes at T+5s, a webhook can land
between): watermark on `(updated_at, fetched_at)` so whoever has the newer fact
wins regardless of write order; per-installation advisory lock so writes don't
interleave; optimistic version check so a concurrent webhook bump makes the
reconcile write a no-op.

**Stage-gap weak link:** `push` moves `aheadBy` without moving any PR's
`updated_at`, so an `openPullsEtag`-only reconcile can miss it. Fold **branch-tip
ETags into the composite** so the cheap frequent reconcile catches push-drift.

### Cold start & backfill

A new installation has no rows. On install-event (or lazy on first cold read),
run `pipeline.refresh(token, null)` once (~5s full build) to populate, then
webhooks take over. Between install and materialized, the read path **falls
through to `pipeline.currentQueue(token)`** — rail-less first paint in ~1-2s with
a "still syncing" flag — so the dashboard is never empty. This means synchronous
GitHub reads are never fully deleted; "webhook-only" means "for materialized
installs," not "ever."

### Migration safety — shadow mode (do not skip)

The silent event→state mapping bug is the dangerous failure. Run OLD (pipeline)
and NEW (webhook read model) in parallel, **serve OLD**, diff them, emit
`shadow.mismatch{field, kind}`. Classify timing (different fetch instants, via
watermark) vs bug (same watermark, different `decision`). Cut over per-install
only when bug-mismatches = 0 over 24-48h of real traffic covering
merges/pushes/reviews. Costs ~2× compute during rollout — that's the price of
confidence, and it's the one false economy that turns this from production to toy.

## Topology decision: hybrid destination, minimal for now

| Piece | Where | Why |
|---|---|---|
| Web + auth (Better Auth) | **Vercel** (unchanged) | Sessions + authorization tables already co-located; no boundary to cross |
| Read path | **Vercel → Neon** | Reads already 0-6ms; auth join stays local; NOTIFY invalidates |
| Read model | **Neon Postgres** | Only shared store, has LISTEN/NOTIFY, co-located with auth tables |
| Webhook ingest | Vercel fn first → **Lambda Function URL** later | Trivial, stateless, no Effect layers — cold start irrelevant |
| Durable queue | **SQS Standard** (the one genuine AWS win) | Nothing on Vercel/Neon provides durable retry+DLQ |
| Event processor | Existing container first → **Fargate** later | Effect layers stay warm; Lambda refights cold-start init every invocation and can't run background revalidation. **Never Lambda for this.** |

**Data gravity:** Neon already runs on AWS regions, so put any AWS compute in
Neon's region — "cross-cloud latency" is avoidable, which kills DynamoDB and
Aurora (Aurora also has a $43/mo floor for zero benefit). **No VPC/NAT** — reach
Neon over public TLS, saving ~$40/mo.

**Cost:** minimal phase adds **$0**. Hybrid adds **~$17-35/mo** (one small
Fargate task + trivial SQS/Lambda). The real budget constraint isn't the AWS
bill — it's GitHub's 2000-GraphQL-points/min secondary limit if many active
installs rebuild at once; scheduling's job is to stagger.

## Sequenced plan — each step shippable, reversible, system live throughout

1. **Materialize the read model in Neon (no AWS).** Pipeline writes RepoFlow
   state to `pr`/`stage_gap` rows *in addition to* the in-process Ref. Reads
   still come from the Ref. Additive, invisible.
2. **Switch reads to Neon + LISTEN/NOTIFY.** Fixes multi-instance invalidation;
   reads stay single-digit ms. Flag-reversible.
3. **Webhook ingest as a Vercel function (still no AWS).** Verify + dedupe +
   drive incremental update (or simplest first cut: mark installation dirty, let
   the pipeline recompute). **Freshness 45s → seconds — the moment it feels
   live.** Shadow-mode here before trusting the incremental path.
4. **(Only if durability demands) SQS + webhook-receiver Lambda.** Deliveries
   survive processor deploys/outages. Vercel path stays as fallback.
5. **(Only at scale) Move the processor to Fargate in Neon's region.** Near
   lift-and-shift of the existing container; layers stay warm.

**A handful of orgs should stop after step 3** (pure Vercel/Neon) and revisit
AWS only when missed-delivery drift or deploy-window loss actually bites.

## Do this first, regardless

Before any of the above: **the per-PR thread split** (drop `reviewThreads` +
`comments` from the bulk queue fragment, fetch on dossier focus). Measured
2.7s → 1.3s per repo, cost 24 → 2 points. It halves the current 5s cold load,
is ~an hour of work, and buys the room to build the read model properly instead
of under pressure. It also makes step 1 cheaper (the pipeline it writes to Neon
is faster).

## Honest caveats (what "correct" actually costs)

- Reconcile interval = hard ceiling on wrongness. 2-3 min is affordable *only
  because 304s are free*; if many installs genuinely change every cycle,
  GraphQL points become the binding constraint — monitor and back off per-install.
- Watermarking shrinks the race window to sub-second ties, not zero. Reconcile
  convergence is the actual guarantee.
- Stage gaps are the weakest link (no per-PR event carries them).
- Synchronous GitHub reads are never fully deleted (cold-start fallback).
- Shadow mode is ~2× compute during rollout and non-optional.

## Flagged uncertainties (verify at implementation)

- GitHub's webhook redelivery retention window (count/age) — affects outage
  recovery *precision*, not correctness (reconcile is the guarantee).
- Neon LISTEN/NOTIFY across the PgBouncer pooler — the listener may need a
  direct (non-pooled) connection; poll `fetched_at` as fallback.
- Single-PR `PullFields` exact point cost — inferred ~2pts from the 12x measure;
  confirm before sizing the rate budget (headroom is large regardless).
