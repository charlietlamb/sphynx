interface PullRef {
  readonly number: number;
  readonly owner: string;
  readonly repo: string;
}

interface OpenShape {
  readonly openPulls: readonly PullRef[];
}

interface PipelineShape<Repo extends OpenShape> {
  readonly repos: readonly Repo[];
}

/**
 * Pulls the client has merged but whose merge has not yet reached the read
 * model. A merge is accepted by GitHub before the `pull_request closed` webhook
 * materializes into Neon (~1s later), so a refetch in that window returns the
 * pull as still open and resurrects it in the queue. A tombstone keeps it out
 * of the list until the read model catches up.
 *
 * Keyed by identity, valued by the merge time so the tombstone can expire.
 */
export type PendingMerges = Readonly<Record<string, number>>;

const keyOf = (ref: PullRef) => `${ref.owner}/${ref.repo}/${ref.number}`;

export function markMerged(
  store: PendingMerges,
  ref: PullRef,
  mergedAt: number
): PendingMerges {
  return { ...store, [keyOf(ref)]: mergedAt };
}

/** Drop a tombstone whose merge turned out to fail, so the pull reappears. */
export function unmarkMerged(
  store: PendingMerges,
  ref: PullRef
): PendingMerges {
  const key = keyOf(ref);
  if (!(key in store)) {
    return store;
  }
  const next = { ...store };
  delete next[key];
  return next;
}

export function withoutMerged<Repo extends OpenShape>(
  pipeline: PipelineShape<Repo>,
  store: PendingMerges
): PipelineShape<Repo> {
  if (Object.keys(store).length === 0) {
    return pipeline;
  }
  return {
    ...pipeline,
    repos: pipeline.repos.map((repo) => ({
      ...repo,
      openPulls: repo.openPulls.filter((pull) => !(keyOf(pull) in store)),
    })),
  };
}

/**
 * Retire a tombstone once it has done its job: either the read model no longer
 * returns the pull as open (the merge landed), or the safety window has passed
 * (a missed webhook must not hide a pull forever). Keeping it any longer would
 * suppress the pull even after it is legitimately gone or reopened.
 */
export function clearSettledMerges<Repo extends OpenShape>(
  pipeline: PipelineShape<Repo>,
  store: PendingMerges,
  now: number,
  ttl = 30_000
): PendingMerges {
  const stillOpen = new Set<string>();
  for (const repo of pipeline.repos) {
    for (const pull of repo.openPulls) {
      stillOpen.add(keyOf(pull));
    }
  }
  const next: Record<string, number> = {};
  for (const [key, mergedAt] of Object.entries(store)) {
    if (stillOpen.has(key) && now - mergedAt < ttl) {
      next[key] = mergedAt;
    }
  }
  return Object.keys(next).length === Object.keys(store).length ? store : next;
}
