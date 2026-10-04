#!/usr/bin/env bash
set -uo pipefail

SCRIPTS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT" || exit 1

pr_base() {
  local base
  base=$(gh pr view --json baseRefName -q .baseRefName 2>/dev/null) || base=""
  printf 'origin/%s' "${base:-main}"
}

BASE_REF=${BASE_REF:-$(pr_base)}
git fetch -q origin "${BASE_REF#origin/}" 2>/dev/null || true
PERF=${PERF:-full}
SKIP=${SKIP:-}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BRANCH=$(git rev-parse --abbrev-ref HEAD | tr '/' '-')
EVIDENCE=${EVIDENCE_DIR:-${TMPDIR:-/tmp}/sphynx-verify/$BRANCH-$STAMP}
SCRATCH_DB=sphynx_scratch_verify_$$
mkdir -p "$EVIDENCE"

results=()
failed=0

database_url() {
  local from_env=""
  if [ -f "$ROOT/.env.local" ]; then
    from_env=$(grep -E '^DATABASE_URL=' "$ROOT/.env.local" | head -1 | cut -d= -f2-)
  fi
  bun "$SCRIPTS/database-url.ts" "${PERF_DATABASE_URL:-${from_env:-postgresql://localhost:5432/postgres}}" "$1"
}

admin_url() {
  database_url postgres
}

scratch_url() {
  database_url "$SCRATCH_DB"
}

drop_scratch() {
  local admin
  admin=$(admin_url) && psql "$admin" -qAtc "drop database if exists $SCRATCH_DB with (force)" >/dev/null 2>&1
}
trap drop_scratch EXIT

step() {
  local name=$1
  shift
  if [[ " $SKIP " == *" $name "* ]]; then
    results+=("SKIP  $name")
    return
  fi
  local log="$EVIDENCE/$name.log"
  local began=$SECONDS
  echo "== $name"
  if "$@" >"$log" 2>&1; then
    results+=("PASS  $name ($((SECONDS - began))s) $(summary_of "$name" "$log")")
  else
    results+=("FAIL  $name ($((SECONDS - began))s) see $log")
    failed=$((failed + 1))
    tail -20 "$log"
  fi
}

summary_of() {
  case "$1" in
    test) sed 's/\x1b\[[0-9;]*m//g' "$2" | grep -aoE ':test: +[0-9]+ (pass|fail)' | awk '{ s[$3] += $2 } END { printf "%d tests passed, %d failed", s["pass"], s["fail"] }' ;;
    e2e) grep -oE '[0-9]+/[0-9]+ scenarios passed' "$2" | tail -1 ;;
    perf) grep -oE '[0-9]+ regressed (over both passes|beyond [0-9.]+%)' "$2" | tail -1 ;;
    *) ;;
  esac
}

route_tree() {
  [ -f apps/web/src/routeTree.gen.ts ] || (cd apps/web && bun run build)
}

changed_files() {
  { git diff --name-only --diff-filter=ACMR "$1"; git ls-files --others --exclude-standard; } |
    sort -u |
    grep -E '\.(ts|tsx|js|mjs|cjs|json|jsonc|css)$' |
    grep -vE '^(\.claude/worktrees|scripts/fixtures|context)/' |
    while read -r file; do [ -f "$file" ] && printf '%s\n' "$file"; done
}

biome_changed() {
  local base files
  if ! base=$(git merge-base HEAD "$BASE_REF"); then
    echo "could not find a merge base with $BASE_REF, so there is nothing to diff biome against"
    return 1
  fi
  files=$(changed_files "$base")
  if [ -z "$files" ]; then
    echo "no changed files biome checks"
    return 0
  fi
  echo "$files"
  echo "$files" | xargs bunx biome check
}

tests_on_scratch() {
  local admin url
  admin=$(admin_url) || return 1
  url=$(scratch_url) || return 1
  psql "$admin" -qAtc "drop database if exists $SCRATCH_DB with (force)" &&
    psql "$admin" -qAtc "create database $SCRATCH_DB" &&
    DATABASE_URL=$url bun run db:migrate &&
    EVAL_REQUIRE_DATABASE=1 EVAL_TEST_DATABASE_URL=$url DATABASE_URL=$url bunx turbo run test --force
}

sdk_smoke() {
  (cd packages/sdk && bun run build) &&
    env -u SPHYNX_API_KEY SPHYNX_BROWSER=none bun packages/sdk/dist/bin.cjs eval scripts/fixtures/local-smoke/smoke.eval.ts --local
}

base_checkout() {
  local sha dir
  sha=$(git rev-parse --verify "$BASE_REF^{commit}") || return 1
  dir=${TMPDIR:-/tmp}/sphynx-verify-base-${sha:0:8}
  if [ ! -f "$dir.ready" ]; then
    if [ -e "$dir" ]; then
      if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null)" != "$sha" ]; then
        echo "$dir exists but is not a checkout of $sha; remove it with git worktree remove --force $dir" >&2
        return 1
      fi
    else
      git worktree add --detach "$dir" "$sha" >&2 || return 1
    fi
    (cd "$dir" && bun install >&2) || return 1
    touch "$dir.ready"
  fi
  printf '%s' "$dir"
}

perf_ab() {
  local base
  base=$(base_checkout) || return 1
  local flags=()
  [ "$PERF" = quick ] && flags+=(--quick)
  bun run perf ab all --before "$base" ${flags[@]+"${flags[@]}"}
}

step install bun install
step routes route_tree
step typecheck bun run typecheck
step check bun run check
step comments bun run check:comments
step knip bun run knip
step biome biome_changed
step test tests_on_scratch
step e2e bun run e2e -- --stop
step sdk-smoke sdk_smoke
if [ "$PERF" = skip ]; then
  results+=("SKIP  perf")
else
  step perf perf_ab
fi

echo
printf '%s\n' "${results[@]}" | tee "$EVIDENCE/summary.txt"
echo "base: $BASE_REF ($(git rev-parse --short "$BASE_REF"))"
echo "evidence: $EVIDENCE"
exit $((failed > 0))
