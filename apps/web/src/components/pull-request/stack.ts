import type { QueuePull } from "@sphynx/schema/review-queue";

export interface StackEntry {
  baseRef: string;
  headRef: string;
  isCurrent: boolean;
  number: number;
  title: string;
}

export interface Stack {
  /** The branch the whole stack ultimately lands on (e.g. `dev`). */
  baseBranch: string;
  /** Base (root) first, tip last — the order GitHub lists a stack in reverse. */
  entries: StackEntry[];
  /** 1-indexed position of the current PR from the base, for the `n/total` badge. */
  position: number;
}

const entryOf = (pull: QueuePull, current: number): StackEntry => ({
  number: pull.number,
  title: pull.title,
  headRef: pull.headRefName,
  baseRef: pull.baseRefName,
  isCurrent: pull.number === current,
});

/**
 * The stack the given PR belongs to: the chain of open PRs linked base→head,
 * from the one that lands on a real branch up to the tip. Built purely from the
 * repo's open pulls — a PR stacks on another when its base is that PR's head, the
 * same linkage the dashboard rail uses. A PR that lands straight on a branch with
 * nothing stacked on it is not a stack (returns null), so the badge only shows
 * for genuine stacks.
 */
export function buildStack(
  pulls: readonly QueuePull[],
  current: number
): Stack | null {
  const self = pulls.find((pull) => pull.number === current);
  if (!self) {
    return null;
  }
  const byHead = new Map<string, QueuePull>();
  const byBase = new Map<string, QueuePull[]>();
  for (const pull of pulls) {
    byHead.set(pull.headRefName, pull);
    const siblings = byBase.get(pull.baseRefName) ?? [];
    siblings.push(pull);
    byBase.set(pull.baseRefName, siblings);
  }

  const chain: QueuePull[] = [self];
  const seen = new Set<number>([self.number]);

  let root = self;
  while (true) {
    const parent = byHead.get(root.baseRefName);
    if (!parent || seen.has(parent.number)) {
      break;
    }
    seen.add(parent.number);
    chain.unshift(parent);
    root = parent;
  }

  let tip = self;
  while (true) {
    const children = (byBase.get(tip.headRefName) ?? []).filter(
      (child) => !seen.has(child.number)
    );
    const child = children[0];
    if (!child) {
      break;
    }
    seen.add(child.number);
    chain.push(child);
    tip = child;
  }

  if (chain.length < 2) {
    return null;
  }

  const entries = chain.map((pull) => entryOf(pull, current));
  const position = chain.findIndex((pull) => pull.number === current) + 1;
  return { entries, baseBranch: root.baseRefName, position };
}
