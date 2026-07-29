interface Watermark {
  readonly fetchedAt: number;
  readonly ghUpdatedAt: number;
  readonly state: string;
}

interface Incoming {
  readonly ghUpdatedAt: number;
  readonly state: string;
}

/**
 * Last-writer-wins on `(ghUpdatedAt, fetchedAt)`, with two guards — the exact
 * invariant the Postgres `setWhere` enforced, reproduced as a pure predicate so
 * a Convex mutation can read the current row and decide whether to write.
 *
 * `ghUpdatedAt` alone is not enough: check_run/status events do not bump a PR's
 * updated_at, so a CI update carries the same ghUpdatedAt as the push before it
 * and would be dropped by a strict `<`. The tie-break lets a write win on an
 * equal ghUpdatedAt — but only against a row that predates this snapshot
 * (`fetchedAt < snapshotAt`). A live webhook passes `snapshotAt = now`, so its
 * fresh CI refetch still wins every tie; a reconcile passes the instant it began
 * reading GitHub, so its stale snapshot loses the tie to any webhook that landed
 * after the snapshot — the model never moves backward on the large class of
 * events that leave ghUpdatedAt unchanged.
 *
 * The second guard is state monotonicity: a terminal row (merged/closed) is not
 * reopened by a write that isn't strictly newer by ghUpdatedAt. A lagging GitHub
 * read replica can return a pre-merge state=open snapshot whose updated_at still
 * equals the merge's, winning the tie and resurrecting a merged PR into the open
 * queue. A genuine reopen bumps ghUpdatedAt strictly past the merge, so it lands.
 */
export function shouldApplyPullWrite(
  current: Watermark | null,
  incoming: Incoming,
  snapshotAt: number
): boolean {
  if (current === null) {
    return true;
  }
  const staleReopen =
    current.state !== "open" &&
    incoming.state === "open" &&
    incoming.ghUpdatedAt <= current.ghUpdatedAt;
  if (staleReopen) {
    return false;
  }
  return lessThan(
    [current.ghUpdatedAt, current.fetchedAt],
    [incoming.ghUpdatedAt, snapshotAt]
  );
}

function lessThan(a: [number, number], b: [number, number]): boolean {
  if (a[0] !== b[0]) {
    return a[0] < b[0];
  }
  return a[1] < b[1];
}
