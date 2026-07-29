# Convex migration plan — full cutover (Neon + Effect/Bun → Convex)

## Provenance

Built from a five-agent parallel audit of the live codebase (data/storage,
webhook+materializer+realtime, client, portable domain logic, auth+deploy), the
API-surface enumeration, and Convex's documented limits + the official
`@convex-dev/better-auth` component. Every claim traces to a read file or a cited
doc. Supersedes `webhook-read-model.md` / `webhook-implementation.md`.

## Target (decided)

**Everything on Convex. One backend. Ruthless deletion of Neon + the Effect/Bun
server. One hard cutover on a branch, then flip.**

Confirmed decisions:
- **Effect survives inside function bodies.** Convex owns the boundary (`v.*`
  validators, queries/mutations/actions, its runtime, realtime). Inside each
  handler, domain logic runs as Effect via `Effect.runPromise(program.pipe(
  Effect.provide(...)))` — services, pipelines, `Schema` for GitHub-payload
  parsing, error channels, retry/schedule all kept. Convex replaces only the
  top-level runtime/HTTP/layer system (`BunRuntime.runMain`, `HttpApiBuilder`,
  `Bun.serve`).
- **Auth via `@convex-dev/better-auth`** (official, Convex-team-maintained):
  GitHub OAuth, organization plugin, session sync into Convex tables, OAuth
  callback hosted by Convex HTTP actions. Better-auth is *ported onto* Convex, not
  reimplemented as Convex Auth.
- **`ghu_` token refresh is spike-gated** (see Stage A) — it is the one auth risk
  that can silently 401 writes after 8h.
- **No shadow-mode.** Build the complete system on a branch, verify end-to-end
  against the Convex dev deployment with subagents per stage, then one cutover +
  delete. No parallel Neon run in prod.

---

## Complete current feature inventory (everything that must survive)

Grouped by surface. This is the acceptance checklist — every item gets an E2E
verification at its stage.

### A. Auth & identity
1. GitHub OAuth sign-in / sign-out (better-auth GitHub **App** social provider).
2. Cookie sessions, 5-min cookie cache, DB-backed session store.
3. Organization plugin: `activeOrganizationId` populated on session create.
4. **Two credential kinds**: installation token (reads, App rate budget) vs user
   `ghu_` token (writes, human attribution).
5. `ghu_` refresh-on-read (8h token / 6-month refresh) via `getAccessToken`.
6. Installation resolution order: `x-sphynx-installation` header → org-linked →
   user's first installation from `GET /user/installations`.

### B. GitHub App integration
7. RS256 App JWT signing (`node:crypto`, 9-min TTL, 60s skew backdate).
8. Installation token minting + 50-min cache.
9. Private-key `pemFrom` normalization (`\\n`→`\n`, trim) — env-var safe.

### C. Read model (dashboard queue + rail + workbench)
10. Pipeline read (`getPipeline`) — repos → flows → open pulls + stage-gap rail.
11. Queue read (`getQueue`) — lighter, no rail.
12. Repo flow read (`getRepoFlow`) — on-demand single-repo build.
13. Repos list (`listRepos`), installations list + resolve.
14. Per-pull decision engine (ready/contested/needs-eyes/draft), blocker text.
15. Reviewer verdicts, AI-score parsing, bot detection.
16. CI state + counts + failing-check list.
17. Unresolved-thread count + thread previews.
18. Stage-gap rail: ahead-by, direct commits, promotion-PR detection, gap pulls,
    release-PR-in-sync display.
19. Workbench feed (repo events) — pr-opened/merged/closed, reviews, comments,
    push, branch create/delete, release.
20. Pull-request page freshness: head-sha "new commits" banner.

### D. Realtime
21. Sub-second push on any read-model change (currently SSE + LISTEN/NOTIFY).
22. Reconnect recovery (no missed updates across a dropped socket / redeploy).
23. Per-(installation,PR) debounce (CI-matrix storm → one refetch).

### E. Writes (user-attributed)
24. Merge pull (`mergePull`) + optimistic remove + tombstone (no resurrection).
25. Block/unblock pull (`blockPull`).
26. Create promotion PR (`createPromotion`).
27. Comment mutations: add conversation comment, create review comment, reply,
    resolve thread, submit review, discard review (7 in `comments.ts`).
28. Resync installation (on-demand full rebuild).

### F. PR-page data
29. Pull summary (conditional-GET/ETag today).
30. Patches (files + diff + symbol index) — immutable, content-addressed.
31. File contents by sha+path — immutable.
32. Comment threads, conversation, pending review, viewed files.
33. Prefetch-on-hover for the pull summary.

### G. Search
34. Live-GitHub PR search (`searchPulls`) — arbitrary query passthrough.

### H. Backstop
35. Reconcile: 15-min sweep of webhook-quiet installations; the sole repair path
    for dropped/failed webhook projections. Never reuses a persisted ETag.
36. Webhook ingest: HMAC verify (two-secret rotation), delivery dedup, 202-fast.
37. Prune: webhook_delivery >48h, workbench_event >30d, merged/closed pulls >30d.

---

## Convex constraints the plan is built around

- Actions (external fetch): 10 min Node / 30 min V8. Backfill (~5s) fits.
- Queries/mutations: **1s user-code limit**, 32k scanned / 16k written per txn →
  big materialization writes **chunk across scheduled mutations**.
- HTTP actions: `request.bytes()` + headers → HMAC ports; verify before mutation.
  `node:crypto.timingSafeEqual` → **Node-runtime action** (`"use node"`).
- **No partial index** → hot `WHERE state='open'` becomes an indexed field +
  filtered query.
- **No unique constraint** → enforce in mutation code.
- **No conditional upsert (`ON CONFLICT ... setWhere`)** → monotonicity gate =
  read-then-conditional-write in one serializable mutation.
- **No FK/cascade** → cascade deletes iterated (or moot if children embedded).
- **No correlated subqueries / json_agg** → separate indexed queries or embed.
- Crons run **once globally** → drop advisory-lock leader election.
- float64 numbers → `review_thread.root_comment_id` (bigint) as `v.int64` or
  string; timestamps become numeric ms (the gate compares them).
- **Effect runs inside handlers** but each function's args/returns are `v.*`
  validated — the Effect `Schema` contracts are re-expressed as `v.*` at the
  boundary and kept as Effect `Schema` for internal GitHub-payload parsing.

---

## The two hard reimplementations (where risk concentrates)

### 1. Monotonicity gate (highest correctness risk)
Today: atomic SQL `setWhere`
`(gh_updated_at, fetched_at) < (incoming, snapshotAt) AND NOT staleReopen` —
last-writer-wins + terminal-state guard so a lagging replica or same-`gh_updated_at`
CI event can't resurrect a merged PR ([[merge-webhook-lag-resurrection]],
[[read-model-watermark-monotonicity]]).
Convex: `writePull` mutation reads the doc by deterministic key, applies the exact
tuple comparison + `staleReopen` guard in an Effect program run inside the handler,
writes only if it passes. Mutations are serializable → atomic. **Port the invariant
tests first; prove the gate before anything depends on it.** Preserve `snapshotAt`
semantics (webhook=now wins ties; reconcile=read-start-instant loses to newer
webhooks) and the departed-pull close (open→merged when absent, only if
`fetched_at < snapshotAt`).

### 2. Per-(installation,PR) debounce/coalesce (hardest re-architecture)
Today: in-memory `Ref<Set>` pending/running collapses a 50-event CI matrix to one
refetch, never dropping final state. No stateless equivalent.
Convex: a `pull_refresh` table with a status field. Webhook action schedules a
refresh; a **mutation** does compare-and-set (claim `running`, else queue
`pending`); an **action** does the live GitHub fetch (action/mutation boundary);
on completion a mutation re-checks `pending` and reschedules. Scheduler +
serializable mutations provide the atomicity the `Ref` gave.

---

## Effect-in-Convex pattern (the house style for this migration)

```ts
// convex/github/refreshPull.ts
export const refreshPull = internalAction({
  args: { installationId: v.number(), owner: v.string(), repo: v.string(), number: v.number() },
  handler: (ctx, args) =>
    Effect.runPromise(
      refreshPullProgram(args).pipe(
        Effect.provide(GitHubLive),           // services survive
        Effect.tapErrorCause(logCause),        // error channel survives
        Effect.scoped,
      ),
    ),
});
```
- **Boundary**: `v.*` validators, `ctx.db`/`ctx.scheduler`/`ctx.runMutation`.
- **Body**: Effect program with services, `Schema.decodeUnknown` for GitHub
  payloads, retry/schedule, typed errors.
- `ctx.db` writes happen either by handing `ctx` into a thin Effect service, or by
  returning plain data from the Effect program and letting the Convex handler write
  it. Recommend the latter (program stays pure-ish, handler does the `ctx.db`
  write) — least coupling, easiest to test.
- **Node vs V8**: HMAC + RS256 signing actions are `"use node"`; everything else
  runs in the faster V8 runtime.

---

## Stages (all on the migration branch; subagent E2E verify each before the next)

### Stage A — Spikes & provisioning (de-risk before committing)
- **Auth spike (gating):** GitHub App login via `@convex-dev/better-auth`; force
  `ghu_` expiry; call `getAccessToken`; perform a real merge with the refreshed
  token. **If refresh fails on the stateful config, stop and design a fallback**
  (manual `refreshAccessToken` + re-store) before proceeding.
- **Effect-in-Convex spike:** one `internalAction` running an Effect program with a
  provided service + `Schema` decode, in both V8 and Node runtimes. Confirm bundle
  size + cold start acceptable.
- Provision Convex project (dev + prod). Set every secret from the config table;
  store the PEM with `pemFrom` normalization proven.
- **Verify:** subagent runs both spikes, reports pass/fail with evidence.

### Stage B — Schema + monotonicity mutation
- `convex/schema.ts`: 12 review tables. **Embed** reviewers/checks/threads on the
  pull doc (1 MiB limit ample; makes the hot read one query and the gate one doc).
  Keep the deterministic string (`${installationId}:${owner}:${repo}:${number}`)
  as an indexed `key` field. Indexes per current query shape
  (`by_installation_state`, `by_repo_number`, `by_key`, feed
  `by_installation_occurredAt`, `pull_head` `by_owner_repo_headSha`, …).
- Port `queue-decision.ts` + `queue-mappers.ts` logic **verbatim** (audit-confirmed
  pure; swap only the raw-GraphQL `Schema` input shims) + `pipeline.ts` topology
  helpers verbatim.
- Re-express the 13 read-model structs as `v.*` validators; keep Effect `Schema`
  for GitHub-payload decoding inside bodies.
- `writePull` mutation with the **monotonicity gate**; port the invariant tests.
- **Verify:** subagent runs the gate tests + a `payload → writePull → read`
  round-trip; asserts no stale-reopen, tie-break correctness.

### Stage C — Materializer + writer (actions/mutations)
- Node action: App JWT (RS256) + installation-token mint, cached in a Convex table
  (keyed by installationId, `expires_at`, 50-min TTL). `pemFrom` ported.
- `materialize(installationId)` action: fetch full pipeline (reuse GraphQL
  fragment + `toQueuePull` in an Effect body), stamp `snapshotAt` before touching
  GitHub, **never reuse a persisted ETag** ([[reconcile-etag-wedge]]), chunk writes
  across scheduled mutations. Single-flight via a lock doc / scheduler dedup.
- Port `writePipeline`/`writeWorkbenchEvents`/`writePullHead`/`deletePullHead`/
  `prune`; departed-pull close + cascade iterate docs.
- **Verify:** subagent materializes a real installation into Convex dev, diffs the
  resulting queue against the current Neon-backed `/api/github/pipeline` for the
  same installation → structural equality.

### Stage D — Webhook HTTP action + projector
- `httpAction` (stable URL, re-point the GitHub App webhook): `request.bytes()`,
  HMAC verify (two-secret `some()`, Node runtime), dedup (read-by-index + insert in
  one mutation), `ctx.scheduler.runAfter(0, project, …)`, 202 immediately.
- Port `projectionFor` + feed mappers **verbatim** (pure). Wire `projectPull` →
  `pull_refresh` compare-and-set (§hard-2) → refetch action → `writePull`. Port
  `projectStatus` (status→PR via `pull_head`), `projectHead`, `projectWorkbench`.
  Preserve the two divergent event sets (PR-refresh vs feed-row) exactly.
- **Verify:** subagent sends signed test deliveries (crafted HMAC), asserts 202
  <100ms, dedup on repeat, row updates; merges a real PR in `useautumn/autumn`,
  asserts it leaves the Convex queue in ~1s; fires a 10-event burst, asserts one
  refetch.

### Stage E — Reconcile cron
- `crons.interval(15min)` → `reconcileOnce`: **drop advisory lock** (single-writer).
  Port `staleInstallationIds` (NOT-IN recent-webhook window as two queries diffed
  in JS) + `prune` + `materialize(id, seed=false)` per stale install via scheduler
  fan-out. Preserve `snapshotAt` + no-ETag. Resolves the pre-existing
  in-process-loop-vs-Vercel-Cron duplication into one path.
- **Verify:** subagent disables the webhook, mutates a PR on GitHub, asserts
  reconcile repairs the Convex row within the interval.

### Stage F — Auth on Convex (better-auth component)
- Install `@convex-dev/better-auth`; register routes in `convex/http.ts` (OAuth
  callback hosted by Convex). Port GitHub App provider + organization plugin +
  `activeOrganizationId`-on-session. Migrate users/accounts/sessions/orgs/members/
  installations into the component's Convex tables.
- Wire the two credential kinds: installation token (Node action, from Stage C)
  for reads; `getAccessToken`-refreshed `ghu_` for writes. **The Stage-A spike must
  have passed.**
- **Verify:** subagent drives full login → session → read (installation token) →
  write (user token) → org-scoped access; forces token expiry and re-verifies a
  write refreshes.

### Stage G — Writes + search as Convex functions
- Merge/block/promote + the 7 comment/review mutations → Convex mutations/actions
  running the GitHub call as the user token (Effect body). Preserve the
  no-resurrection contract: write intent transactionally; the reactive read model
  repaints when the webhook lands (the **tombstone may collapse** into a
  transactional intent field — decide + test the merge→disappear flow).
- `searchPulls` → a Convex action (installation token) hitting GitHub search; the
  60s cache becomes a small Convex table or is dropped (nicety, not correctness).
- **Verify:** subagent performs each write end-to-end against a real repo, asserts
  GitHub attribution to the user + the read model reflects it within ~1s.

### Stage H — Frontend cutover to Convex hooks
- Replace `usePipeline`/`useQueue`/`useRepoFlow`/workbench/PR-freshness with Convex
  `useQuery` (live). **Delete** both `EventSource` hooks, the debounce,
  reconnect-recovery, `keys.ts`, `fetchWithEtag`/ETag cache, the SSE-invalidation
  wiring.
- Re-express the 8 optimistic mutations via Convex `withOptimisticUpdate`
  (auto-rollback — drop sentinels, manual cancel/snapshot/restore,
  `isMutating()===1`, all `onSettled` invalidates).
- **Keep on HTTP/TanStack Query** *only* if genuinely non-Convex: content-addressed
  patches/file-contents (immutable blobs — serve from a Convex action/file storage
  or keep as GitHub-proxied HTTP), live-GitHub search result rendering,
  mirrored-theme (client-only). Decide patches: Convex file storage vs
  keep-proxied. Recommend keep-proxied (immutable, cache-friendly, no Convex value
  add).
- Head-sha banner: reactive field on the pull doc; client diffs the reactive value.
- Wrap the app in `ConvexBetterAuthProvider`; port `auth-client.ts` to the Convex
  better-auth client.
- **Verify:** subagent (browser automation) drives the full dashboard + PR page:
  queue loads, live update on a real merge, optimistic merge/block, PR page freshness
  banner, search, workbench feed — against the Convex dev deployment.

### Stage I — Ruthless deletion + deploy
- **Delete**: the entire `apps/server` Effect/Bun app (or reduce to nothing —
  Convex is the backend), `packages/db` review schema + Neon read model,
  `event-bus.ts`, `listen.ts`, SSE route, reconcile route, pipeline orchestration,
  composite-ETag machinery, `keys.ts`, ETag cache, both SSE hooks, `Dockerfile.vercel`,
  the `server` service in `vercel.json`, `LISTEN_DATABASE_URL` + Neon env vars.
- Keep `queue-decision`/`queue-mappers`/pipeline-helpers as ported Convex modules;
  keep the web app on Vercel (static/SPA) pointing at Convex.
- Re-point GitHub App: **webhook URL** → Convex HTTP action; **OAuth callback URL**
  → Convex better-auth route.
- **Verify:** full end-to-end acceptance run of the entire feature inventory (§A–H)
  by subagents against the deployed Convex prod, on the branch, before merge.

### Stage J — Cutover
- Merge the branch, point prod at Convex, decommission the Neon read model + the
  Vercel container. Monitor freshness + the monotonicity gate (no resurrected PRs)
  for 24–48h.

---

## What survives verbatim
`queue-decision.ts` (decision engine, bot detection, AI-score parsing),
`queue-mappers.ts` mapping logic, `pipeline.ts` topology helpers, `projectionFor`
+ all feed mappers, the GraphQL `PULL_FIELDS_FRAGMENT`. Plus — per the Effect
decision — these run *inside* Convex handlers as Effect programs, so the service
definitions, `Schema` decoders, and error channels are preserved, not rewritten.

## Effort & risk
Rough **4–6 weeks** for a full cutover (vs 3–4 for the earlier hybrid — auth +
writes + frontend + deletion are all in scope now). Load-bearing risks, in order:
1. `ghu_` token refresh on Convex better-auth (**spike-gated, Stage A**).
2. Monotonicity gate fidelity (**Stage B, tested first**).
3. Debounce re-architecture (**Stage D**).
4. The action/mutation boundary threading Effect programs cleanly (**Stage A
   spike de-risks**).

## Open decisions for you
1. **Patches/file-contents**: Convex file storage vs keep GitHub-proxied HTTP
   (recommend proxied — immutable, no Convex value).
2. **Tombstone**: collapse into a transactional merge-intent field vs keep the
   client tombstone store (decide at Stage G with the merge test).
3. **Data migration**: re-materialize everything from GitHub on cutover (recommend
   — it's a read model, rebuild is clean) vs migrate Neon rows into Convex.
