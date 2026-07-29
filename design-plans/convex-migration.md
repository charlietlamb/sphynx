# Convex migration plan — full cutover (Neon + Effect/Bun → Convex)

## Provenance

Built from: a five-agent parallel audit of the live codebase (data/storage,
webhook+materializer+realtime, client, portable domain logic, auth+deploy); the
API-surface enumeration; a digest of the `waynesutton/convexskills` skill set (now
in `.claude/skills/convex-*`); Convex's documented limits; the official
`@convex-dev/better-auth` (Local Install) and `@convex-dev/migrations` components.
Every claim traces to a read file or cited doc. Supersedes `webhook-read-model.md`
/ `webhook-implementation.md`. Lives on branch `feat/convex-migration`.

## Target (decided)

**Everything on Convex. One backend. Ruthless deletion of Neon + the Effect/Bun
server. One hard cutover on a branch, then flip.**

Locked decisions:
- **Effect survives inside Convex function bodies** via
  `Effect.runPromise(program.pipe(Effect.provide(...)))` — services, pipelines,
  `Schema` (GitHub-payload parsing), error channels, retry/schedule kept. Convex
  owns the boundary: `v.*` validators, query/mutation/action, runtime, realtime,
  `ctx.db`/`ctx.scheduler`. No bespoke Effect↔Convex adapter (none exists; don't
  build one). Program returns plain data; the Convex handler does the `ctx.db`
  write — least coupling, most testable.
- **Auth: `@convex-dev/better-auth` Local Install** — we own the auth schema in
  `convex/betterAuth/` (generated via `npx auth generate`, custom indexes extended
  in a secondary file). GitHub App social provider + organization plugin + session
  sync + OAuth callback hosted by Convex HTTP. Functions read auth tables directly.
- **`ghu_` token refresh is spike-gated (Stage A)** — the one thing that silently
  401s writes after 8h.
- **Data migration = re-materialize from GitHub on cutover** (it's a read model;
  rebuild is clean). Use `@convex-dev/migrations` for any in-Convex backfill.
- **Immutable blobs (patches/file-contents) → Convex file storage**, keyed by git
  sha (Convex `_storage` already computes `sha256`); append-only, no orphan risk.
  Removes the last "stays on HTTP" exception → truly one backend.
- **No shadow-mode.** Build the whole system on the branch, subagent-verify each
  stage against the Convex dev deployment, then one cutover + delete.

---

## Convex house rules (from the skills — enforced by @convex-dev/eslint-plugin)

Every Convex function in this migration MUST follow these or the build fails:
1. **Object syntax with `args`, `returns`, `handler`** on every function — no
   exceptions. Empty args = `args: {}`.
2. **Reads → `query`; writes → `mutation`; external APIs → `action`.** Actions have
   NO direct DB access — read/write via `ctx.runQuery`/`ctx.runMutation`.
3. **Node APIs (`node:crypto` RS256/HMAC) → a separate `"use node"` action file.**
   `convex/http.ts` and `convex/crons.ts` stay V8 and delegate to `"use node"`
   internal actions.
4. **Sensitive/internal logic → `internalQuery`/`internalMutation`/`internalAction`,
   called via `internal.*`.** Scheduled + cron targets are ALWAYS `internal.*`,
   never `api.*`. Webhook handlers call `internal.*`.
5. **Filter with `withIndex`, never `.filter()`.** Every index used exists in
   schema; index name lists all fields in order (`by_installation_and_state`);
   query fields in defined order.
6. **Idempotent mutations** — early-return if the transition already happened;
   patch directly (don't read-then-patch); `Promise.all` for independent writes.
7. **Timestamps `v.number()`; large ints `v.int64()`; distinguish `v.optional`
   from `v.union(x, v.null())`; discriminated unions for polymorphic tables; avoid
   `v.any()`.** System fields `_id`/`_creationTime` never in `defineTable` but
   always in `returns`.
8. **Secrets in Convex env vars, read only inside actions, never returned to
   clients.** `ConvexError` for user-facing errors; sanitize external errors.
9. **New fields added `v.optional` first; backfill batched; optional→required only
   after backfill.** Never `npx convex deploy` or git unless instructed; never edit
   `convex/_generated/`.
10. **Self-rescheduling batch idiom** (the one pattern for cron + backfill +
    materialize chunking): `paginate({numItems, cursor})` → process page →
    `if (!result.isDone) ctx.scheduler.runAfter(0, sameFn, {cursor: result.continueCursor})`.

`avoid-feature-creep` caveat: its "reject extra validators/error-handling/refactor"
patterns conflict with the mandatory rules above. For THIS migration the Convex
correctness rules (validators, indexes, idempotency, auth checks) are in-scope
requirements, not creep — do not let scope discipline talk you out of them. Where
it DOES apply: no new product features during the migration; port behavior 1:1.

---

## Complete current feature inventory (the E2E acceptance checklist)

Every item gets a subagent verification at its stage.

### A. Auth & identity
1. GitHub OAuth sign-in/out (GitHub **App** provider). 2. Cookie sessions + cache.
3. Organization plugin: `activeOrganizationId` on session. 4. Two credential kinds:
installation token (reads, App budget) vs user `ghu_` (writes, human attribution).
5. `ghu_` refresh-on-read (8h/6mo). 6. Installation resolution order (header →
org-linked → user's first).

### B. GitHub App integration
7. RS256 App JWT (9-min TTL, 60s skew). 8. Installation-token mint + 50-min cache.
9. Private-key `pemFrom` normalization (`\\n`→`\n`).

### C. Read model (dashboard queue + rail + workbench)
10. Pipeline read. 11. Queue read. 12. Repo-flow read. 13. Repos/installations
list + resolve. 14. Decision engine (ready/contested/needs-eyes/draft) + blocker.
15. Reviewer verdicts, AI-score parsing, bot detection. 16. CI state/counts/
failing checks. 17. Unresolved-thread count + previews. 18. Stage-gap rail
(ahead-by, direct commits, promotion-PR + release-PR-in-sync). 19. Workbench feed.
20. PR-page head-sha "new commits" banner.

### D. Realtime
21. Sub-second push on any read-model change. 22. Reconnect recovery. 23.
Per-(installation,PR) debounce (CI-matrix storm → one refetch).

### E. Writes (user-attributed)
24. Merge + optimistic remove + no-resurrection. 25. Block. 26. Create promotion.
27. Comment/review mutations (7). 28. Resync installation.

### F. PR-page data
29. Summary. 30. Patches (immutable). 31. File contents by sha (immutable). 32.
Threads, conversation, pending review, viewed files. 33. Prefetch-on-hover.

### G. Search
34. Live-GitHub PR search (arbitrary query).

### H. Backstop
35. Reconcile (15-min sweep of webhook-quiet installs; sole repair path; no ETag
reuse). 36. Webhook ingest (HMAC two-secret, dedup, 202-fast). 37. Prune.

---

## Convex constraints the plan is built around

- Actions: 10 min Node / 30 min V8; backfill (~5s) fits.
- Queries/mutations: **1s user-code, 32k scanned / 16k written per txn** → big
  materialization **chunks across scheduled mutations** (rule 10).
- HTTP actions: `request.text()`/`.bytes()` + headers → HMAC ports; verify (in a
  `"use node"` internal action) before the write.
- **No partial index** → hot open-pulls read = indexed `state` field + `withIndex`.
- **No unique constraint** → enforce in mutation code.
- **No conditional upsert** → monotonicity gate = read-then-conditional-write in one
  serializable mutation.
- **No FK/cascade** → cascade iterated (or moot with embedded children).
- **No correlated subqueries/json_agg** → embed children on the pull doc.
- Crons: `crons.interval` only (not deprecated helpers); UTC; run globally.
- float64 → `root_comment_id` as `v.int64()`; timestamps numeric ms.

---

## The two hard reimplementations (skills-validated designs)

### 1. Monotonicity gate (highest correctness risk)
SQL `setWhere` `(gh_updated_at, fetched_at) < (incoming, snapshotAt) AND NOT
staleReopen` → a `writePull` **mutation** that reads the doc by its indexed `key`,
applies the exact tuple comparison + `staleReopen` guard (as an Effect program in
the handler body), writes only if it passes. Mutations are serializable → atomic
(idempotent per rule 6). Preserve `snapshotAt` semantics (webhook=now wins ties;
reconcile=read-start loses to newer webhooks) and departed-pull close. **Port the
invariant tests first; prove the gate before anything depends on it.**
([[merge-webhook-lag-resurrection]], [[read-model-watermark-monotonicity]])

### 2. Per-(installation,PR) debounce (skills confirm the shape)
The in-memory `Ref<Set>` pending/running → a `pull_refresh` table with a status
field. The skills' **claim-via-status-mutation** pattern is exactly this: a mutation
flips `pending→running` (the serialization point), an action does the live GitHub
fetch (action/mutation boundary), a completion mutation re-checks `pending` and
`ctx.scheduler.runAfter(0, sameFn, ...)` reschedules. Serializable mutations +
scheduler give the atomicity the `Ref` gave in-process.

---

## Stages (all on `feat/convex-migration`; subagent E2E verify gates each)

### Stage A — Spikes & provisioning (de-risk first)
- **Auth spike (GATING):** GitHub App login via `@convex-dev/better-auth` Local
  Install; force `ghu_` expiry; `getAccessToken`; real merge with the refreshed
  token. Fails → design fallback (`refreshAccessToken` + re-store) before Stage F.
- **Effect-in-Convex spike:** one `internalAction` running an Effect program with a
  provided service + `Schema` decode, V8 and Node. Confirm bundle/cold-start OK.
- Init Convex (dev+prod), `@convex-dev/eslint-plugin`, `@convex-dev/better-auth`,
  `@convex-dev/migrations`. Set every secret env var; PEM with `pemFrom` proven.
- **Verify:** subagent runs both spikes, reports pass/fail with evidence.

### Stage B — Schema + monotonicity mutation
- `convex/schema.ts`: 12 review tables. **Embed** reviewers/checks/threads on the
  pull doc (1 MiB ample; hot read = one indexed query; gate = one doc). Keep the
  deterministic string `${installationId}:${owner}:${repo}:${number}` as an indexed
  `key`. Indexes per query shape (`by_installation_and_state`, `by_repo_and_number`,
  `by_key`, feed `by_installation_and_occurredAt`, `by_owner_repo_and_headSha`).
- Port `queue-decision.ts` + `queue-mappers.ts` + pipeline topology helpers
  **verbatim** (audit-confirmed pure; swap raw-GraphQL `Schema` shims only). Keep
  as Effect programs called from handlers.
- Re-express 13 read-model structs as `v.*`; keep Effect `Schema` for GitHub-payload
  decode inside bodies.
- `writePull` **internalMutation** with the monotonicity gate; port invariant tests.
- **Verify:** subagent runs gate tests + `payload → writePull → read` round-trip;
  asserts no stale-reopen, tie-break correctness.

### Stage C — Materializer + writer (actions/mutations)
- `"use node"` action: App JWT (RS256) + installation-token mint, cached in a
  Convex table (`by_installationId`, `expires_at`, 50-min TTL). `pemFrom` ported.
- `materialize(installationId)` action: fetch full pipeline (GraphQL fragment +
  `toQueuePull` in Effect body), stamp `snapshotAt` before GitHub, **never reuse a
  persisted ETag** ([[reconcile-etag-wedge]]), **chunk writes via rule-10 batches**.
  Single-flight via a lock doc / scheduler dedup key.
- Port `writePipeline`/`writeWorkbenchEvents`/`writePullHead`/`deletePullHead`/
  `prune` as internalMutations; departed-pull close + cascade iterate docs.
- **Verify:** subagent materializes a real installation into Convex dev, diffs the
  queue against the current Neon `/api/github/pipeline` → structural equality.

### Stage D — Webhook HTTP action + projector
- `convex/http.ts` (V8): route `/api/github/webhooks`, read `request.text()` +
  `X-Hub-Signature-256`/`X-GitHub-Event`/`X-GitHub-Delivery`,
  `ctx.scheduler.runAfter(0, internal.github.project, {...})`, **return 202
  immediately**. HMAC verify (two-secret `some()`) in a `"use node"` internalAction
  (`node:crypto` — confirm exact shape via context7 at build). Dedup: read
  `webhook_delivery` by index + insert in one mutation.
- Port `projectionFor` + feed mappers **verbatim** (pure). Wire `projectPull` → the
  `pull_refresh` claim-mutation (§hard-2) → refetch action → `writePull`. Port
  `projectStatus`/`projectHead`/`projectWorkbench`. Preserve the two divergent event
  sets (PR-refresh vs feed-row) exactly.
- **Verify:** subagent sends signed test deliveries (crafted HMAC) → 202 <100ms,
  dedup on repeat, row updates; merges a real PR in `useautumn/autumn` → leaves the
  Convex queue ~1s; 10-event burst → one refetch.

### Stage E — Reconcile cron
- `convex/crons.ts`: `crons.interval("reconcile", {minutes:15}, internal.github.
  reconcile, {})`. **Drop advisory-lock leader election** (single-writer). Port
  `staleInstallationIds` (NOT-IN recent-webhook window as two queries diffed in JS)
  + `prune` + `materialize(id, seed=false)` via scheduler fan-out. Preserve
  `snapshotAt` + no-ETag. Resolves the pre-existing loop-vs-cron duplication.
- **Verify:** subagent disables the webhook, mutates a PR on GitHub, asserts
  reconcile repairs the Convex row within the interval.

### Stage F — Auth on Convex (Better Auth Local Install)
- `convex/betterAuth/` local component: `convex.config.ts`, generated `schema` (via
  `npx auth generate`), `adapter.ts` (`createApi`). `convex/auth.ts`:
  `createAuthOptions` + `createAuth` + `authComponent` with `local.schema`. GitHub
  App provider + organization plugin (`activeOrganizationId`). Register routes in
  `convex/http.ts`. Custom indexes extended in a secondary file.
- Two credential kinds: installation token (Stage-C `"use node"` action) for reads;
  `getAccessToken`-refreshed `ghu_` for writes. **Stage-A spike must have passed.**
- Row-level auth (skills rule): reads scoped to the installation the user may access
  (`ctx.auth.getUserIdentity()` → verify membership); writes verify user ownership.
- **Verify:** subagent drives login → session → read (installation token) → write
  (user token) → org-scoped access; forces token expiry, re-verifies a write.

### Stage G — Writes + search + blobs as Convex functions
- Merge/block/promote + 7 comment/review mutations → Convex actions running the
  GitHub call as the user token (Effect body), internal-mutation DB writes.
  No-resurrection: write intent transactionally; reactive read model repaints when
  the webhook lands (the client **tombstone may collapse** into a transactional
  merge-intent field — decide + test merge→disappear).
- `searchPulls` → action (installation token) hitting GitHub search; 60s cache → a
  small Convex table or dropped (nicety).
- **Blobs**: patches/file-contents → `ctx.storage.store(blob)` in an action, a
  `blobs` table (`by_sha` → `storageId` + `_storage.sha256`), served via
  `ctx.storage.getUrl`. Append-only.
- **Verify:** subagent performs each write end-to-end on a real repo → GitHub
  attribution to the user + read model reflects it ~1s; fetches a patch blob twice
  (cache hit).

### Stage H — Frontend cutover to Convex hooks
- Replace `usePipeline`/`useQueue`/`useRepoFlow`/workbench/PR-freshness with Convex
  `useQuery` (live; `"skip"` for conditional; `usePaginatedQuery` for large feeds;
  split subscriptions to bound invalidation). **Delete** both `EventSource` hooks,
  the debounce, reconnect-recovery, `keys.ts`, `fetchWithEtag`/ETag cache, SSE
  invalidation wiring.
- Re-express the 8 optimistic mutations via `withOptimisticUpdate` (auto-rollback —
  drop sentinels, manual cancel/snapshot/restore, `isMutating()===1`, all
  `onSettled` invalidates).
- Head-sha banner → reactive field on the pull doc; client diffs the reactive value.
- `ConvexBetterAuthProvider` in `__root.tsx`; `auth-server.ts`
  (`convexBetterAuthReactStart`) for SSR token; `beforeLoad` hydration; port
  `auth-client.ts`. Keep only mirrored-theme on TanStack Query (client-only).
- **Verify:** subagent (browser automation) drives full dashboard + PR page: queue
  loads, live update on a real merge, optimistic merge/block, freshness banner,
  search, workbench — against Convex dev.

### Stage I — Ruthless deletion + deploy
- **Delete**: `apps/server` (the Effect/Bun app), `packages/db` review schema +
  Neon read model, `event-bus.ts`, `listen.ts`, SSE route, reconcile route, pipeline
  orchestration, composite-ETag machinery, `keys.ts`, ETag cache, both SSE hooks,
  `Dockerfile.vercel`, the `server` service in `vercel.json`, Neon/LISTEN env vars.
  Keep the ported pure modules as Convex code.
- Web app stays on Vercel (static/SPA) pointing at Convex. Re-point the GitHub App:
  **webhook URL** → Convex HTTP action; **OAuth callback URL** → Convex Better Auth.
- Run `npx eslint convex/` (the plugin) clean + the sphynx gate on the web side.
- **Verify:** full E2E acceptance of the entire inventory (§A–H) by subagents
  against deployed Convex prod, on the branch, before merge.

### Stage J — Cutover
- Merge the branch, point prod at Convex, decommission the Neon read model + the
  Vercel container. Monitor freshness + the gate (no resurrected PRs) 24–48h.

---

## What survives verbatim
`queue-decision.ts` (decision engine, bot detection, AI-score parsing),
`queue-mappers.ts` mapping logic, `pipeline.ts` topology helpers, `projectionFor` +
feed mappers, the GraphQL `PULL_FIELDS_FRAGMENT` — all run *inside* Convex handlers
as Effect programs, so service definitions, `Schema` decoders, and error channels
are preserved, not rewritten.

## Effort & risk
Rough **4–6 weeks**. Load-bearing risks, in order: (1) `ghu_` refresh on Convex
Better Auth (spike-gated, Stage A); (2) monotonicity-gate fidelity (Stage B, tested
first); (3) debounce re-architecture (Stage D); (4) threading Effect programs across
the action/mutation boundary (Stage-A spike de-risks).

## Skills to invoke per stage (now in .claude/skills/)
- B: `convex-schema-validator`, `convex-functions`, `convex-best-practices`
- C/E: `convex-functions`, `convex-cron-jobs`, `convex-migrations`
- D: `convex-http-actions`, `convex-security-check`
- F: `convex-security-audit`, `convex-best-practices`
- G: `convex-file-storage`, `convex-functions`
- H: `convex-realtime`
- I: `convex-security-check` + `convex-security-audit` (full pass before cutover)

## Open decisions (recommendations noted; confirm at their stage)
1. Merge tombstone: collapse into a transactional intent field vs keep client store
   (decide Stage G with the merge test).
2. Blob storage: Convex file storage (recommended, one backend) — confirmed above.
3. Reconcile cadence: 15-min interval (as today) vs tune.
