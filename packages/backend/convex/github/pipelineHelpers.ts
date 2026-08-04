const PR_NUMBER_PATTERN = /#(\d+)\b/;

/**
 * Keep only the pulls that actually promote into a gap's target branch. A gap
 * scrapes `#N` from every commit in its `lower...upper` compare, but a backmerge
 * that landed on `lower` (e.g. a `main -> dev` sync, whose merge commit is a new
 * commit on dev) leaves its `#N` in that compare too. Such a pull has
 * `baseRefName === lower`, not `upper`, so filtering on the target base drops it
 * — otherwise the same pull surfaces both as its backflow control and as a
 * phantom `lower -> upper` promotion.
 */
export function promotionPullsForGap<T extends { baseRefName: string }>(
  pulls: readonly T[],
  target: string
): T[] {
  return pulls.filter((pull) => pull.baseRefName === target);
}

export function commitPullNumbers(messages: readonly string[]) {
  const numbers: number[] = [];
  let direct = 0;
  const seen = new Set<number>();
  for (const message of messages) {
    const firstLine = message.split("\n")[0] ?? "";
    const match = PR_NUMBER_PATTERN.exec(firstLine);
    if (match) {
      const number = Number(match[1]);
      if (!seen.has(number)) {
        seen.add(number);
        numbers.push(number);
      }
    } else {
      direct += 1;
    }
  }
  return { numbers, direct };
}

export function stageChain(refs: {
  defaultBranch: string;
  hasDev: boolean;
  hasStaging: boolean;
  prod: string | null;
}) {
  if (!refs.hasDev) {
    return [refs.defaultBranch];
  }
  const stages = ["dev"];
  if (refs.hasStaging) {
    stages.push("staging");
  }
  if (refs.prod && refs.prod !== "dev") {
    stages.push(refs.prod);
  }
  return stages;
}

const STALE_STAGE_THRESHOLD = 300;

export function dropStaleMiddleStages(
  stages: readonly string[],
  aheadOfMiddle: number | null
) {
  if (
    stages.length === 3 &&
    aheadOfMiddle !== null &&
    aheadOfMiddle > STALE_STAGE_THRESHOLD
  ) {
    const first = stages[0];
    const last = stages[2];
    return first && last ? [first, last] : [...stages];
  }
  return [...stages];
}
