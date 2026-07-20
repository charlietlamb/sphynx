# Data layer rewrite: authenticate, revalidate, invalidate

## Why this is a rewrite and not a patch

Three mechanisms currently answer "is this data fresh?" — a TTL, a background
`markStale` throttle, and a `?since=` fingerprint — and they were added in that
order, each to fix a symptom of the previous. They now contradict each other.
The `?since=` param is the newest and messiest, but deleting it alone would
restore the staleness it was written to fix. The freshness *model* is what needs
replacing.

Every number below was measured against live GitHub on 2026-07-20, not inferred.

## The measurements that drive the design

### Authentication is the whole ballgame

| Request | Quota cost |
|---|---|
| Authenticated `304 Not Modified` | **0** |
| Unauthenticated `304 Not Modified` | **1** |

A conditional request is free *only* with an `Authorization` header — GitHub
documents this on the REST best-practices page, and it is confirmed by
measurement (authenticated quota held at 4989 across a 304; unauthenticated went
39 → 38).

This is the fact the current architecture violates. `client.ts` attaches no
credential at all, so the PR-page path runs on the **60 requests/hour per-IP**
anonymous limit. Measured consequence in production:

| PR files endpoint | Time |
|---|---|
| Quota exhausted | **5.47s** for 25 KB |
| Quota available | **0.10s** |

Same code, same payload, 55× difference. The 543 KB → 25.6 KB payload work
shipped earlier today was real and did nothing for this, because bytes were
never the constraint.

### The credential that solves it already exists

`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are still in `.env`, believed unused
since the App migration. Measured, via HTTP Basic:

- `rate_limit` → **5,000/hr** (vs 60)
- `GET /repos/useautumn/autumn/pulls/2296` → **200**, on a repo the App is *not*
  installed on

It authenticates as the OAuth *app*, not a user, so it sees exactly what an
anonymous visitor would see — correct scope for public pages — while lifting the
ceiling 83× and making 304s free. (Query-param client credentials were disabled
by GitHub in 2021; Basic auth only, server-side only.)

This matters because the App is installed on exactly one account
(`charlietlamb`); `GET /repos/useautumn/autumn/installation` returns 404. There
is no installation token available for arbitrary public repos, which is *why*
the anonymous path exists. Client credentials fill that gap.

### REST and GraphQL are asymmetric

- REST: every list endpoint tested returns an ETag and honours `If-None-Match`
  (`pulls/:n`, `/files`, `/pulls?state=open`, `/comments`, `/compare`). Three
  full GETs plus three revalidations cost **1 unit total**.
- GraphQL: **no ETag, no conditional requests.** Every query costs points.

So: poll REST aggressively and nearly free; cache GraphQL hard and refresh it
sparingly. This inverts the usual "prefer GraphQL, fewer round trips" instinct,
and the 304 rule is the reason.

Notably GraphQL cost is *not* the dashboard's problem — one query returning 20
open PRs with reviews and CI rollup costs **1 point**. The expense is the
per-repo REST `compare` fan-out in `flowFromRefs`, which is ETag-able.

### The plumbing is already built and dead

`client.ts:168` sends `if-none-match`. `client.ts:179-182` returns
`{_tag:"NotModified"}` on 304. `pulls.ts:39,50` forward the header. But the
server stores no ETag of its own — it only relays the browser's, and the browser
never sends one (`fetchDecoded` does a bare `fetch(url)`). The entire 304 path is
unreachable code.

## Problems found by audit

Ranked by severity. Each is evidenced.

### P1 — Anonymous requests on the hot path
`client.ts:164-170` attaches no bearer token. Everything else follows from this.

### P2 — The fingerprint compares two different quantities (shipped today, latent)
- Probe: `review-queue.ts:193,204` → `pullRequests(states:[OPEN]) { totalCount }`
- Cache: `pipeline-cache.ts:60-66` → `repo.openPulls.length`, from an array
  capped at `first: 30` (`review-queue.ts:131`)

Any repo with >30 open PRs makes these permanently unequal → `behind` is true on
every request forever → an unthrottled ~55-call rebuild per request. Currently
dormant only because the largest observed repo has 28 open PRs. One more PR trips
it. `pipeline-fingerprint.test.ts` verifies the string format agrees while the
semantics diverge — exactly the failure the shared module was meant to prevent.

### P3 — Rebuilt data is never served
`?since=` deliberately returns stale data and forks a rebuild
(`pipeline-cache.ts:147-152`). But the client's query key is the *new* version,
which is stable, so nothing refetches. The fresh build can sit unserved for the
full 10-minute TTL.

### P4 — Dashboard invalidation is a no-op
Four call sites invalidate `["pipeline"]` by prefix
(`use-pull-actions.ts:14`, `use-promote.ts:27`, `use-reply-thread.ts:23`,
`use-resolve-thread.ts:22`). Prefix-matching hits the entry, but `since` is
unchanged, so the server's `behind` check is false and it serves the same build
back. Merging a PR does not move it out of the queue.

### P5 — Caches keyed on raw bearer tokens
`conversation.ts:40-45` and `repo-events.ts:16-20` key on `token`, which
`credential.ts:15-19` explicitly forbids ("Installation tokens expire hourly, so
the raw token must never be used as a cache key"). Hourly rotation orphans every
entry; the 1-hour viewer cache has a TTL equal to the token lifetime, so its hit
rate is ~0 by construction.

Worse, `conversation.ts:105-107` uses `token === ""` as the anonymous sentinel,
so one cache holds both per-user and shared-anonymous conversations for the same
PR, and writes must invalidate both by hand (`conversation.ts:141-146`).

### P6 — Duplicated and uncached expensive work
`/files` (client loop) and `/patches` (server loop) walk the same file pages,
both sequentially. `getPullRequestPatches` is the most expensive endpoint and has
neither a server cache nor a cache header, while the cheap `getPullRequest` has
both.

### P7 — Three uncoordinated polling loops
`use-pipeline-freshness.ts:7` (60s), `use-workbench-events.ts:32` (60s, polls
even when the sheet is closed), `pull-request-queries.ts:206` (45s). Plus tab
focus fires the probe twice — once via TanStack's focus manager, once via
`useVisiblePoll`'s `visibilitychange` handler — and `probe.refetch()` bypasses
`staleTime` unconditionally.

### P8 — Cached failures
`repo-events.ts:36` runs `orElseSucceed(() => null)` *inside* the cache lookup,
so one 500 from `/user` caches `viewer: null` for a full hour.

### P9 — Query cache used as mutable state
`pull-request-queries.ts:98-105` — `enabled:false`, `queryFn: () => null`,
written via `setQueryData`. Inherits `gcTime: 5min`, so the access-denied banner
silently vanishes.

## Correction to a premise

The `/api/public/` prefix is naming only. `getConversation`
(`pull-request-conversation.ts:94`) and `listCommentThreads`
(`pull-request-comments.ts:101`) declare `cookieHeaders` and read the session;
their handlers try authenticated first and fall back
(`routes/conversation.ts:17-22`, `routes/comments.ts:24-31`). Only
`getPullRequest`, `/files`, `/patches`, `/file-contents` are genuinely anonymous.

The same URL therefore returns different bodies to different users from a
token-keyed shared cache. Any per-surface caching decision must respect this, and
the naming should change so the property is visible.

## Target architecture

Three layers, each with one job.

### 1. Credential resolution — one function, three tiers

```
resolveCredential(ref, session) ->
  session?                      -> user installation token   (5,000-12,500/hr)
  repo has an App installation? -> installation token        (5,000-12,500/hr)
  otherwise                     -> OAuth client credentials  (5,000/hr, public data only)
```

No request ever leaves without an `Authorization` header. This alone fixes P1 and
is the precondition for everything below.

### 2. Server: one revalidating store, keyed structurally

Replace the six ad-hoc caches with a single `GitHubStore` service holding, per
entry: the value, its ETag, and its fetch time.

- Reads serve the cached value immediately.
- Revalidation replays `If-None-Match`. A 304 is free and just extends freshness.
- Only a 200 replaces the value and notifies.
- Keys are `Data.Class`, never raw tokens (fixes P5) and never string-joined
  (`search-cache.ts:49` parses its own key back out with `split(" ")`).
- Failures are never cached as successes (fixes P8).

Because revalidation is free, the 15s fingerprint probe, the `?since=` param, the
`markStale` throttle, and the `generation` counter all disappear — the store
knows whether anything changed by asking GitHub for nothing.

### 3. Client: identity in keys, freshness as an event

Query keys carry identity only. A key factory nests
installation → repo → pull → entity so invalidation is a prefix match at any
level (today repo-level invalidation is impossible; `installationId` sits at
position 1 in one key and position 4 in others).

Freshness arrives as HTTP `ETag`/`If-None-Match` on our own endpoints, so the
browser revalidates cheaply and the version string never enters a key. That fixes
P3 and P4 together: invalidation starts working, and `keepPreviousData` — added
to mask key churn — is no longer needed.

## Sequencing

Each step is independently shippable and independently verifiable.

| # | Change | Fixes | Verify |
|---|---|---|---|
| 1 | Credential resolution; remove the anonymous path | P1 | PR page TTFB, quota headers |
| 2 | Server ETag store; delete fingerprint endpoint, `?since=`, `markStale`, `generation` | P2, P3 | 304 ratio; rebuild count per request |
| 3 | Structural cache keys; stop caching failures | P5, P8 | token rotation keeps hits; a 500 doesn't pin |
| 4 | Client key factory; freshness via HTTP not keys | P4 | merge removes the row |
| 5 | Collapse `/files` + `/patches`; cache + header `/patches` | P6 | round trips per PR page |
| 6 | One visibility-aware probe per scope | P7 | background request volume |
| 7 | Optimistic dashboard mutations; delete duplicate hooks | P4 | row moves instantly |
| 8 | `access-block` out of the query cache | P9 | banner persists |

Step 1 is the one that fixes the reported symptom. Steps 2-4 are the rewrite
proper. 5-8 are cleanup that becomes safe once freshness is coherent.

## What gets deleted

- `?since=` from `getPipeline` (`review-queue.ts:206`)
- `pipeline-version.ts`, `pipeline-version-cache.ts`, the `/pipeline/version`
  endpoint, `pipeline-fingerprint.ts` and its test
- `markStale`, `generation`, `refreshInBackground` from `pipeline-cache.ts`
- `head-poll` (`pull-request-queries.ts:211-218`) — a duplicate of the summary
  query under a different key, which defeats deduplication
- `use-reply-thread.ts`, `use-resolve-thread.ts` — strictly worse copies of
  already-optimistic PR-page mutations
- The anonymous branch in `client.ts`

## Explicitly out of scope

**Webhooks.** They are the right long-term answer for freshness and would remove
polling entirely. They also bring signature verification, a 10s delivery budget,
`X-GitHub-Delivery` dedupe, out-of-order handling, replay, secret rotation, and a
reconciliation sweep to catch drift. Authenticated revalidation is free and gets
most of the benefit for a fraction of the work. Revisit once this is stable.

**Postgres as source of truth.** Would decouple pageviews from GitHub quota and
survive GitHub outages. Real value, much larger change. Not now.

## Open questions

1. **Anonymous PR pages — keep or drop?** Client credentials make them viable at
   5,000/hr. Dropping them instead would simplify caching considerably, since the
   token-keyed dual-audience problem (P5) disappears. This is a product call.
2. **Multi-instance correctness.** In-process caches are fine on a single Vercel
   container but diverge across replicas. Postgres is the only shared store; no
   Redis. Acceptable while single-instance — needs a decision before scaling out.
3. **`MAX_DISCOVERED_REPOS = 12` and `first: 30`** silently cap what the dashboard
   can see. Intentional, or a stopgap that became permanent?
